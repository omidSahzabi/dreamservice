"use client";
import React, { useState } from 'react';
import { DreamForm, FieldConfig } from '@/components/modules/dream-form/dream-form';
import { cn } from '@/lib/utils';
import {useTranslations} from 'next-intl';
import {useRouter} from '@/lib/i18n/navigation';

export default function Packages() {
  const [searchQuery, setSearchQuery] = useState('');
  const t = useTranslations('Packages');
  const router = useRouter();
  const packages = ['support', 'mentorship', 'store', 'seo', 'web', 'backend', 'frontend', 'placeholder', 'app'].map((key, index) => ({id: index + 1, title: t(`items.${key}.title`, {number: index + 1}), description: t(`items.${key}.description`)}));
  
  const filteredPackages = packages.filter(pkg =>
    pkg.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pkg.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const searchField: FieldConfig[] = [
    {
      name: 'search',
      label: t('searchLabel'),
      type: 'text',
          showLabel: false,
      placeholder: t('searchPlaceholder'),
      prefix: (
        <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      ),
    },
  ];

  return (
    <section className="pb-7 px-4 flex justify-center">
      <div className="w-full max-w-6xl mx-auto pb-3">
        <div className="text-center pb-7">
          <h2 className="text-3xl font-bold text-foreground pb-2">
            {t("title")}
          </h2>
          <p className="text-muted-foreground">
            {t("description")}
          </p>
        </div>
        
        <div className="pb-10">
          <DreamForm
            fields={searchField}
            onSubmit={(data) => setSearchQuery(typeof data.search === "string" ? data.search : "")}
            onValuesChange={data => setSearchQuery(typeof data.search === "string" ? data.search : "")}
            showResetButton={false}
            showSubmitButton={false}
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPackages.map((pkg) => (
            <button
              key={pkg.id}
              className={cn(
                "h-16 flex items-stretch border border-border bg-card",
                "rounded-xl overflow-hidden",
                "hover:bg-secondary transition-colors focus:outline-none focus:ring-2 focus:ring-ring/40"
              )}
              onClick={() => router.push('/order/order-form')}
            >
              <div className="w-14 bg-primary flex items-center justify-center rounded-tr-lg rounded-xl overflow-hidden -me-px">
                <svg 
                  className="w-5 h-5 ltr:rotate-180"
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </div>
              
              <div className="flex-1 flex items-center justify-center">
                <span className="text-foreground font-medium text-lg">
                  {pkg.title}
                </span>
              </div>
            </button>
          ))}
        </div>
        
        {filteredPackages.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <p className="text-muted-foreground text-lg">
              {t("empty")}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}