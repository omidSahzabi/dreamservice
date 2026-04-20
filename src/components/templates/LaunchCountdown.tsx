"use client";
import React, { useState, useEffect } from 'react';
import { DreamForm, FieldConfig } from '@/components/modules/dream-form/dream-form';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export default function LaunchCountdown(): JSX.Element {
  // تاریخ لانچ پروژه
  const launchDate = new Date('2025-06-15T00:00:00').getTime();
  
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  const [isLaunched, setIsLaunched] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const difference = launchDate - now;

      if (difference <= 0) {
        setIsLaunched(true);
        return { days: 0, hours: 0, minutes: 0, seconds: 0 };
      }

      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((difference % (1000 * 60)) / 1000),
      };
    };

    setTimeLeft(calculateTimeLeft());
    
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [launchDate]);

  // فیلدهای فرم تیکت
  const ticketFields: FieldConfig[] = [
    {
      name: 'email',
      label: 'ایمیل',
      type: 'email',
      placeholder: 'ایمیلت رو وارد کن',
      validation: [
        { type: 'required', message: 'ایمیل الزامی است' },
        { type: 'email', message: 'ایمیل معتبر نیست' },
      ],
      prefix: (
        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      inputClassName: '!bg-gray-800/50 !border-gray-700 !text-white !placeholder:text-gray-500 hover:!border-gray-600',
    },
    {
      name: 'message',
      label: 'پیام',
      type: 'textarea',
      placeholder: 'پیامت رو بنویس...',
      rows: 3,
      inputClassName: '!bg-gray-800/50 !border-gray-700 !text-white !placeholder:text-gray-500 hover:!border-gray-600',
    },
  ];

  const handleSubmit = (data: Record<string, unknown>) => {
    console.log('تیکت ثبت شد:', data);
    alert('تیکت با موفقیت ثبت شد! 🎉');
  };

  const timeUnits = [
    { value: timeLeft.days, label: 'روز' },
    { value: timeLeft.hours, label: 'ساعت' },
    { value: timeLeft.minutes, label: 'دقیقه' },
    { value: timeLeft.seconds, label: 'ثانیه' },
  ];

  return (
    <section className="py-20 px-4 flex justify-center">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
            {isLaunched ? 'پروژه منتشر شد! 🚀' : 'به زودی منتشر میشه'}
          </h2>
          <p className="text-gray-400">
            {isLaunched ? 'میتونی همین الان استفاده کنی' : 'منتظر بمون تا اولین نفری باشی که خبردار میشه'}
          </p>
        </div>

        {/* گرید شمارش معکوس */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {timeUnits.map((unit, index) => (
            <div
              key={unit.label}
              className="relative group"
            >
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                
                <div className="relative z-10">
                  <div className="text-4xl md:text-5xl font-bold text-white mb-1">
                    {String(unit.value).padStart(2, '0')}
                  </div>
                  <div className="text-gray-400 text-sm uppercase tracking-wider">
                    {unit.label}
                  </div>
                </div>

                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
              </div>

              {index < timeUnits.length - 1 && (
                <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -ml-2 z-20">
                  <span className="text-3xl text-cyan-400 font-bold">:</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* فرم تیکت با DreamForm */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 md:p-8">
          <div className="flex flex-col md:flex-row gap-6 items-start">     
            <div className="md:w-1/3">
              <h3 className="text-xl font-bold text-white mb-2">
                اطلاع‌رسانی کن
              </h3>
              <p className="text-gray-400 text-sm">
                ایمیلت رو وارد کن تا به محض انتشار پروژه، اولین نفری باشی که خبردار میشه!
              </p>
              <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>رایگان</span>
              </div>
            </div>

            <div className="md:w-2/3 w-full m-3">
              <DreamForm
                fields={ticketFields}
                onSubmit={handleSubmit}
                showResetButton={false}
                submitText="ثبت تیکت"
                submitClassName="!bg-cyan-400 hover:!bg-cyan-300 !text-slate-900 !font-medium"
                className="space-y-4"
              />
            </div>
          </div>
        </div>

        {/* آیکون‌های شبکه‌ای کوچک */}
        <div className="mt-12 flex justify-center gap-2">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-white/10"
              style={{
                animation: `pulse 2s ease-in-out infinite`,
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>

        <style jsx>{`
          @keyframes pulse {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 1; }
          }
        `}</style>
      </div>
    </section>
  );
}