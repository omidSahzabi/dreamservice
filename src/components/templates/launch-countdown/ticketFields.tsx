import { FieldConfig } from '@/components/modules/dream-form/dream-form';

export const ticketFields: FieldConfig[] = [
  {
    name: 'email',
    label: 'ایمیل',
    type: 'email',
    placeholder: 'ایمیلت رو وارد کن',
    validation: [
      { type: 'required', message: 'ایمیل الزامی است' },
      { type: 'email', message: 'ایمیل معتبر نیست' },
    ],
    inputClassName: '!bg-gray-800/50 !border-gray-700 !text-white',
  },
  {
    name: 'message',
    label: 'پیام',
    type: 'textarea',
    placeholder: 'پیامت رو بنویس…',
    rows: 3,
    inputClassName: '!bg-gray-800/50 !border-gray-700 !text-white',
  },
];
