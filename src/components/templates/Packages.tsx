"use client";
import React, { useState } from 'react';
import { DreamForm, FieldConfig } from '@/components/modules/dream-form/dream-form';
import { cn } from '@/lib/utils';
import { packages, Package } from '@/lib/dic';

export default function Packages(): JSX.Element {
  const [searchQuery, setSearchQuery] = useState('');
  
  const filteredPackages = packages.filter(pkg =>
    pkg.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pkg.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const searchField: FieldConfig[] = [
    {
      name: 'search',
      label: 'جستجوی پکیج‌ها', 
      type: 'text',
          showLabel: false,
      placeholder: 'نام پکیج یا توضیحات را وارد کنید...',
      prefix: (
        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      ),
    },
  ];

  return (
    <section className="pb-7 px-4 flex justify-center">
      <div className="w-full max-w-6xl mx-auto pb-3">
        <div className="text-center pb-7">
          <h2 className="text-3xl font-bold text-white pb-2">
            پکیج‌های محبوب
          </h2>
          <p className="text-gray-400">
            سلام داشول
          </p>
        </div>
        
        <div className="pb-10">
          <DreamForm
            fields={searchField}
            onSubmit={(data) => setSearchQuery(data.search)}
            showResetButton={false}
            showSubmitButton={false}
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPackages.map((pkg) => (
            <button
              key={pkg.id}
              className={cn(
                "h-16 flex items-stretch border border-white/10 bg-white/5",
                "rounded-tl-lg rounded-br-lg",
                "hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
              )}
              onClick={() => console.log('Clicked:', pkg)}
            >
              <div className="w-14 bg-cyan-400 flex items-center justify-center rounded-tr-lg rounded-tl-lg rounded-br-lg -mr-px">
                <svg 
                  className="w-5 h-5 text-white" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </div>
              
              <div className="flex-1 flex items-center justify-center">
                <span className="text-white font-medium text-lg">
                  {pkg.title}
                </span>
              </div>
            </button>
          ))}
        </div>
        
        {filteredPackages.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <p className="text-gray-400 text-lg">
              پکیجی با این نام پیدا نشد
            </p>
          </div>
        )}
      </div>
    </section>
  );
}