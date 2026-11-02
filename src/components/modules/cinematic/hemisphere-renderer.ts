import { clamp, climax, handRatios, lerp, shotAt, shotGeometry, smooth, type CinematicFrame } from "./timeline";
import geometry from "@/components/brand/geometry.json";
type Vec3 = [
    number,
    number,
    number
];
/** Perspective renderer ported from the approved standalone reference. No DOM or animation lifecycle ownership. */
export function createHemisphereRenderer(ctx: CanvasRenderingContext2D) {
    let screenW = 0, screenH = 0, sectionProgress = 0, userYaw = 0, userPitch = -.17, reduced = false;
    // The same paths as BrandMark, including its arrow clearance. Never approximate the identity.
    const bow = new Path2D(geometry.arch);
    const clearance = new Path2D(`M0 0h32v32H0Z ${geometry.clearance}`);
    const needle = new Path2D(geometry.needle);
    const string = new Path2D(geometry.string);
    const star = new Path2D(geometry.star);
    let clock: CinematicFrame = {progress: 0, turn: .25, oscillation: 0, settled: false};
    function rand(seed: number) {
        let a = seed;
        return () => {
            a = (Math.imul(a, 1664525) + 1013904223) >>> 0;
            return a / 4294967296;
        };
    }
    const random = rand(80519);
    const hemisphere: Vec3[][] = [];
    for (let t = 0; t <= 15; t++) {
        const theta = t / 15 * Math.PI / 2;
        const row: Vec3[] = [];
        for (let j = 0; j <= 84; j++) {
            const a = j / 84 * Math.PI * 2;
            row.push([Math.sin(theta) * Math.cos(a), Math.sin(theta) * Math.sin(a), Math.cos(theta)]);
        }
        hemisphere.push(row);
    }
    const network: Vec3[] = [];
    for (let i = 0; i < 128; i++) {
        const z = .02 + .96 * random(), a = random() * Math.PI * 2, r = Math.sqrt(1 - z * z);
        network.push([r * Math.cos(a), r * Math.sin(a), z]);
    }
    const links: [
        number,
        number
    ][] = [];
    for (let i = 0; i < network.length; i++) {
        const pairs: [
            number,
            number
        ][] = [];
        for (let j = 0; j < network.length; j++) {
            if (i === j)
                continue;
            const a = network[i], b = network[j], d = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
            if (d < .17)
                pairs.push([d, j]);
        }
        pairs.sort((a, b) => a[0] - b[0]);
        pairs.slice(0, 2).forEach(([, j]) => {
            if (j > i)
                links.push([i, j]);
        });
    }
    const stars = Array.from({ length: 55 }, () => ({ x: random(), y: random(), r: .3 + random() * 1.3, o: .16 + random() * .34 }));
    let cx = 0, cy = 0, R = 0, yaw = 0, pitch = 0;
    function rot(p: Vec3): Vec3 {
        const [x, y, z] = p;
        const cp = Math.cos(pitch), sp = Math.sin(pitch), cy = Math.cos(yaw), sy = Math.sin(yaw);
        const y1 = y * cp - z * sp, z1 = y * sp + z * cp;
        return [x * cy + z1 * sy, y1, -x * sy + z1 * cy];
    }
    function proj(p: Vec3) {
        const [x, y, z] = rot(p);
        const scale = 3.5 / (3.5 - z * .54);
        return { x: cx + x * R * scale, y: cy - y * R * scale, z, scale };
    }
    function stroke3(points: Vec3[], color: string, width = 1, alpha = 1) {
        ctx.beginPath();
        points.forEach((v, i) => {
            const p = proj(v);
            if (i === 0)
                ctx.moveTo(p.x, p.y);
            else
                ctx.lineTo(p.x, p.y);
        });
        ctx.strokeStyle = color;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = width;
        ctx.stroke();
        ctx.globalAlpha = 1;
    }
    function circle2(x: number, y: number, r: number, color: string, blur = 0) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        if (blur) {
            ctx.shadowColor = color;
            ctx.shadowBlur = blur;
        }
        ctx.fill();
        ctx.shadowBlur = 0;
    }
    function drawBackdrop(ms: number) {
        ctx.clearRect(0, 0, screenW, screenH);
        const outer = ctx.createRadialGradient(cx, cy, R * .5, cx, cy, R * 1.9);
        const {tension, calm} = shotAt(sectionProgress);
        outer.addColorStop(0, `rgba(34,202,217,${.12 + tension * .045 - calm * .035})`);
        outer.addColorStop(.48, 'rgba(18,97,125,.065)');
        outer.addColorStop(1, 'rgba(7,26,44,0)');
        ctx.fillStyle = outer;
        ctx.fillRect(0, 0, screenW, screenH);
        ctx.save();
        for (const s of stars) {
            ctx.globalAlpha = s.o * (.85 + .15 * (1 - calm) * Math.sin(ms * .0007 + s.x * 15));
            circle2(s.x * screenW, s.y * screenH, s.r, '#8ce4ef');
        }
        ctx.restore();
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(68,179,200,.07)';
        for (const m of [1.29, 1.55]) {
            ctx.beginPath();
            ctx.ellipse(cx, cy, R * m, R * m * .64, .35, 0, Math.PI * 2);
            ctx.stroke();
        }
        for (let i = 0; i < 20; i++) {
            const a = i * Math.PI * 2 / 20;
            const rr = R * 1.38;
            const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
            ctx.strokeStyle = i % 5 === 0 ? 'rgba(113,231,238,.25)' : 'rgba(113,231,238,.075)';
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(cx + Math.cos(a) * (rr + 7), cy + Math.sin(a) * (rr + 7));
            ctx.stroke();
        }
    }
    function drawDome(ms: number) {
        const calm = shotAt(sectionProgress).calm;
        const shell = [];
        for (let i = 0; i < hemisphere.length - 1; i++) {
            for (let j = 0; j < 84; j += 2) {
                const pts: Vec3[] = [hemisphere[i][j], hemisphere[i + 1][j], hemisphere[i + 1][j + 2], hemisphere[i][j + 2]], scr = pts.map(proj);
                const depth = scr.reduce((a, p) => a + p.z, 0) / 4;
                shell.push({ scr, depth });
            }
        }
        shell.sort((a, b) => a.depth - b.depth);
        for (const poly of shell) {
            ctx.beginPath();
            poly.scr.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
            ctx.closePath();
            const shade = clamp((poly.depth + 1) / 2, 0, 1);
            ctx.fillStyle = `rgba(${Math.round(6 + shade * 8)},${Math.round(49 + shade * 44)},${Math.round(68 + shade * 44)},${(.08 + shade * .12).toFixed(3)})`;
            ctx.fill();
        }
        for (let i = 2; i <= 13; i += 2) {
            stroke3(hemisphere[i], 'rgba(67,209,224,.55)', .85, .23 + (i % 4 === 0 ? .12 : 0));
        }
        for (let j = 0; j < 84; j += 7) {
            const pts = hemisphere.map(row => row[j]);
            stroke3(pts, 'rgba(97,226,229,.43)', .9, .30);
        }
        ctx.strokeStyle = 'rgba(76,225,232,.47)';
        ctx.lineWidth = 1.45;
        const edge = [];
        for (let j = 0; j <= 84; j++)
            edge.push(proj(hemisphere[15][j]));
        ctx.beginPath();
        edge.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
        ctx.stroke();
        ctx.lineWidth = .55;
        for (const [i, j] of links) {
            const a = proj(network[i]), b = proj(network[j]);
            const glow = clamp((a.z + b.z + 1.9) / 3.9, .25, 1);
            ctx.strokeStyle = `rgba(103,231,228,${(.08 + glow * .20).toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
        }
        let ix = 0;
        for (const n of network) {
            const p = proj(n);
            const glow = clamp((p.z + 1.1) / 2.1, .12, 1);
            const pulse = .74 + .26 * (1 - calm) * Math.sin(ms * .0016 + ix * .71);
            circle2(p.x, p.y, 1.15 + pulse * .7, `rgba(141,255,239,${(.25 + glow * .65).toFixed(3)})`, glow > 0.7 ? 5 : 0);
            ix++;
        }
    }
    function drawClockFace() {
        const norm = rot([0, 0, -1]);
        const v = clamp((norm[2] - .04) / .65, 0, 1);
        if (v < .01)
            return;
        ctx.save();
        ctx.globalAlpha = v;
        const ring = [];
        for (let i = 0; i <= 96; i++) {
            const a = i / 96 * Math.PI * 2;
            ring.push(proj([Math.cos(a), Math.sin(a), -.017]));
        }
        ctx.beginPath();
        ring.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
        ctx.closePath();
        const mid = proj([0, 0, -.02]);
        const grad = ctx.createRadialGradient(mid.x, mid.y, R * .09, mid.x, mid.y, R * 1.1);
        grad.addColorStop(0, 'rgba(6,28,40,.98)');
        grad.addColorStop(.75, 'rgba(5,26,39,.98)');
        grad.addColorStop(1, 'rgba(12,75,91,.95)');
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = 'rgba(124,253,242,.9)';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#52e6e5';
        const shot = shotAt(sectionProgress);
        ctx.shadowBlur = 16 + shot.tension * 5 - shot.calm * 7;
        ctx.stroke();
        ctx.shadowBlur = 0;
        const inring = [];
        for (let i = 0; i <= 96; i++) {
            const a = i / 96 * Math.PI * 2;
            inring.push(proj([Math.cos(a) * .82, Math.sin(a) * .82, -.026]));
        }
        ctx.beginPath();
        inring.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
        ctx.closePath();
        ctx.strokeStyle = 'rgba(80,207,225,.26)';
        ctx.lineWidth = 1;
        ctx.stroke();
        for (let i = 0; i < 60; i++) {
            const a = i / 60 * Math.PI * 2 + Math.PI / 2;
            const rr = i % 5 === 0 ? .79 : .87;
            const p1 = proj([Math.cos(a) * rr, Math.sin(a) * rr, -.035]), p2 = proj([Math.cos(a) * .94, Math.sin(a) * .94, -.035]);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = i % 5 === 0 ? 'rgba(173,255,244,.95)' : 'rgba(87,179,202,.48)';
            ctx.lineWidth = i % 5 === 0 ? 2.6 : 1.1;
            ctx.stroke();
        }
        ctx.fillStyle = '#aaf9f2';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `600 ${Math.max(10, R * .085)}px Georgia,serif`;
        for (let h = 1; h <= 12; h++) {
            const a = h * Math.PI / 6 - Math.PI / 2;
            const p = proj([-Math.cos(a) * .68, -Math.sin(a) * .68, -.04]);
            ctx.fillText(String(h), p.x, p.y);
        }
        const hand = (a: number, length: number, w: number, color: string) => {
            const p = proj([Math.cos(a) * length, Math.sin(a) * length, -.06]), mid = proj([0, 0, -.06]);
            ctx.beginPath();
            ctx.moveTo(mid.x, mid.y);
            ctx.lineTo(p.x, p.y);
            ctx.lineCap = 'round';
            ctx.lineWidth = w;
            ctx.strokeStyle = color;
            ctx.shadowColor = color;
            ctx.shadowBlur = w * 2;
            ctx.stroke();
            ctx.shadowBlur = 0;
        };
        const p = clock.turn + clock.oscillation;
        hand(p / handRatios.hour + .45, .46, 8, '#dffefa');
        hand(p / handRatios.minute - 1.4, .64, 5, '#98fff1');
        hand(p - Math.PI / 2, .77, 2, '#38deea');
        const cp = proj([0, 0, -.08]);
        circle2(cp.x, cp.y, 8, '#d4fff6', 11);
        circle2(cp.x, cp.y, 3, '#159eae');
        ctx.restore();
    }
    function drawArrow() {
        const p = sectionProgress;
        if (p < climax.enter || (reduced && p < climax.impact)) return;
        const shot = shotAt(p);
        const center = proj([0, 0, -.08]);
        const size = R * shotGeometry.scale;
        const bowX = center.x - R * shotGeometry.distance - R * .12 * (1 - shot.enter);
        const bowY = center.y + R * .10 * (1 - shot.enter);
        const fade = 1 - smooth(.825, .875, p);
        ctx.save();
        ctx.translate(bowX, bowY);
        ctx.rotate(-.055 * (1 - shot.enter));
        ctx.scale(size, size);
        ctx.globalAlpha = shot.enter * fade;
        ctx.save();
        ctx.translate(-10, -16);
        ctx.clip(clearance, 'evenodd');
        ctx.fillStyle = '#f8fafc';
        ctx.fill(bow, 'evenodd');
        ctx.restore();
        ctx.save();
        // Transform the real string about its two fixed x=7.5 anchors.
        // Only the string stretches during the draw; bow and arrow retain SVG proportions.
        ctx.translate(-10, -16);
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = .8;
        // Stroke under the original transform so drawing does not scale its thickness.
        const stretched = new Path2D();
        stretched.addPath(string, {a: (2.5 + shot.string) / 2.5, d: 1, e: -7.5 * shot.string / 2.5});
        ctx.stroke(stretched);
        ctx.restore();
        ctx.save();
        ctx.translate(-10, -16);
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = .65;
        ctx.stroke(star);
        ctx.restore();
        ctx.restore();

        const nock = bowX + (p < climax.release ? shot.string : -shotGeometry.draw) * size;
        const startTip = nock + 21 * size;
        const tip = lerp(startTip, center.x, shot.flight) + R * shot.penetration;
        const y = lerp(bowY, center.y, shot.flight);
        // A short translucent tail, never a beam across the whole clock.
        if (p > climax.release && p < climax.impact) {
            ctx.save();
            ctx.globalAlpha = Math.sin(Math.min(1, shot.flight) * Math.PI / 2);
            for (let i = 0; i < 8; i++) {
                ctx.beginPath();
                const length = R * (.10 + i * .026) * (1 - shot.calm);
                ctx.moveTo(tip - 23.5 * size - length, y);
                ctx.lineTo(tip - 23.5 * size - length - R * .04, y);
                ctx.strokeStyle = 'rgba(96,234,242,' + .26 * (1 - i / 8) + ')';
                ctx.lineWidth = Math.max(.6, size * .4 * (1 - i / 10));
                ctx.stroke();
            }
            ctx.restore();
        }
        // Effects are painted behind the opaque arrow, including at the brightest frame.
        if (!reduced && p >= climax.impact && p < climax.settled) {
            const s = shot.impact;
            ctx.save();
            // Restrained collision light confined to the hub.
            const flash = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, R * .16);
            flash.addColorStop(0, 'rgba(239,255,255,' + shot.flash + ')');
            flash.addColorStop(.25, 'rgba(146,255,250,' + shot.flash * .65 + ')');
            flash.addColorStop(1, 'rgba(96,234,242,0)');
            ctx.fillStyle = flash;
            ctx.fillRect(center.x - R * .16, center.y - R * .16, R * .32, R * .32);
            // Project the expanding ring onto the same plane as the clock face.
            const radius = .025 + 1.12 * (1 - (1 - s) ** 3);
            ctx.beginPath();
            for (let i = 0; i <= 96; i++) {
                const angle = i / 96 * Math.PI * 2;
                const point = proj([Math.cos(angle) * radius, Math.sin(angle) * radius, -.08]);
                if (i === 0) ctx.moveTo(point.x, point.y);
                else ctx.lineTo(point.x, point.y);
            }
            ctx.strokeStyle = 'rgba(176,255,249,' + .62 * (1 - smooth(.05, 1, s)) + ')';
            ctx.lineWidth = 1.5;
            ctx.shadowColor = '#60eaf2';
            ctx.shadowBlur = 7 * (1 - s);
            ctx.stroke();
            ctx.shadowBlur = 0;
            // Fixed angles and distances keep repeated frames identical.
            for (let i = 0; i < 10; i++) {
                const angle = i * 2.39996;
                const distance = R * (.12 + (i % 3) * .055) * (1 - (1 - s) ** 3);
                ctx.globalAlpha = .48 * (1 - smooth(.05, .9, s));
                circle2(center.x + Math.cos(angle) * distance, center.y + Math.sin(angle) * distance, .65 + (i % 2) * .45, '#a5fff7');
            }
            ctx.restore();
        }
        ctx.save();
        ctx.globalAlpha = shot.enter;
        ctx.translate(tip, y);
        // Pivot at the embedded tip so the shaft vibrates without detaching from the hub.
        ctx.rotate(-.055 * (1 - shot.enter) + (reduced ? 0 : shot.vibration * .025));
        ctx.scale(size, size);
        ctx.translate(-31, -16);
        ctx.fillStyle = '#22d3ee';
        ctx.shadowColor = '#53f2ec';
        ctx.shadowBlur = 3;
        ctx.fill(needle);
        ctx.restore();
    }
    function drawScene(ms: number, dt: number) {
        if (!screenW || !screenH)
            return;
        R = Math.min(screenW * .335, screenH * .315, 240);
        cx = screenW * .51;
        cy = screenH * .5;
        const lock = smooth(.36, .59, sectionProgress);
        const autoYaw = (reduced ? 0 : .19 * Math.sin(ms * .00018)) + .36;
        const targetYaw = Math.PI;
        const desiredYaw = lerp(autoYaw + userYaw, targetYaw, lock);
        const desiredPitch = lerp(-.16 + userPitch, 0, lock);
        const damping = reduced ? 1 : 1 - Math.exp(-dt / 155);
        yaw = lock === 1 ? desiredYaw : lerp(yaw, desiredYaw, damping);
        pitch = lock === 1 ? desiredPitch : lerp(pitch, desiredPitch, damping);
        const shot = shotAt(sectionProgress);
        const ambientTime = reduced ? 0 : ms;
        drawBackdrop(ambientTime);
        drawDome(ambientTime);
        // Less than a pixel at desktop size; only the clock and collision move.
        ctx.save();
        const vibration = reduced ? 0 : shot.vibration * Math.min(1.15, R * .005);
        ctx.translate(vibration, vibration * -.45);
        drawClockFace();
        drawArrow();
        ctx.restore();
    }
    return {
        resize(width: number, height: number) {
            screenW = width;
            screenH = height;
        },
        render(ms: number, dt: number, frame: CinematicFrame, motionReduced: boolean) {
            clock = frame;
            sectionProgress = frame.progress;
            reduced = motionReduced;
            drawScene(ms, dt);
        },
        rotate(deltaYaw: number, deltaPitch = 0) {
            userYaw += deltaYaw;
            userPitch = clamp(userPitch + deltaPitch, -.43, .43);
        },
        reset() {
            userYaw = 0;
            userPitch = -.17;
        }
    };
}
