'use client';

import { Fragment } from 'react';
import { DreamForm } from '@/components/modules/dream-form/dream-form';
import { useCountdown } from './useCountdown';
import { ticketFields } from './ticketFields';
import { TimeUnitBox } from './TimeUnitBox';
import { PulseDots } from './PulseDots';

const launchDate = new Date('2025-06-15T00:00:00');

export default function LaunchCountdown() {
  const { timeLeft, isLaunched } = useCountdown(launchDate);

  const timeUnits = [
    { value: timeLeft.days, label: 'روز' },
    { value: timeLeft.hours, label: 'ساعت' },
    { value: timeLeft.minutes, label: 'دقیقه' },
    { value: timeLeft.seconds, label: 'ثانیه' },
  ];

  return (
    <section className="py-20 px-4 flex justify-center">
      <div className="max-w-4xl w-full space-y-16">
        
        <div className="text-center space-y-3">
          <h2 className="text-4xl font-bold text-white">
            {isLaunched ? 'پروژه منتشر شد! 🚀' : 'به زودی منتشر میشه'}
          </h2>
          <p className="text-gray-400">
            {isLaunched ? 'میتونی همین الان استفاده کنی' : 'خبرت میکنیم'}
          </p>
        </div>

        <div className="flex justify-center">
          <div className="flex items-center gap-4">
            {timeUnits.map((unit, i) => (
              <Fragment key={unit.label}>
                <TimeUnitBox value={unit.value} label={unit.label} />
                {i < timeUnits.length - 1 && (
                  <span className="text-3xl font-bold text-cyan-400 hidden md:block">
                    :
                  </span>
                )}
              </Fragment>
            ))}
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 md:p-8">
          <div className="flex flex-col md:flex-row gap-8">
            
            <div className="md:w-1/3 space-y-2">
              <h3 className="text-xl font-bold text-white">
                اطلاع‌رسانی کن
              </h3>
              <p className="text-gray-400 text-sm">
                ایمیلتو وارد کن تا زمان انتشار خبرت کنیم.
              </p>
            </div>

            <div className="md:w-2/3 w-full">
              <DreamForm
                fields={ticketFields}
                onSubmit={() => alert('تیکت ثبت شد 🎉')}
                submitText="ثبت تیکت"
                submitClassName="!bg-cyan-400 hover:!bg-cyan-300 !text-slate-900 !font-medium"
              />
            </div>

          </div>
        </div>

      </div>
    </section>
  );
}
