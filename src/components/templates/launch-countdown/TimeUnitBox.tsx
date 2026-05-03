export function TimeUnitBox({ value, label, showDivider }) {
  return (
    <div className="relative group">
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center relative">
        <div className="absolute inset-0 bg-cyan-500/10 opacity-0 group-hover:opacity-100 transition" />
        <div className="relative z-10">
          <div className="text-5xl font-bold text-white mb-1">
            {String(value).padStart(2, '0')}
          </div>
          <div className="text-gray-400 text-sm">{label}</div>
        </div>
      </div>

      {showDivider && (
        <div className="hidden md:flex absolute -right-3 top-1/2 text-3xl text-cyan-400 font-bold">:</div>
      )}
    </div>
  );
}
