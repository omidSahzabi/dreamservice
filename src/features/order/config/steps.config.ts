// config/steps.config.ts

import { z } from 'zod';
import {
  step0Schema, step1Schema, step2Schema, step3Schema,
  step4Schema, step5Schema, step6Schema, step7Schema, step8Schema,
} from '../schemas';
import { ORDER_TYPES, GOALS, FEATURES, DESIGN_STYLES, TIMELINES } from '../../../constants';
import type { OrderStep } from '../types/step.types';

export const ORDER_STEPS: OrderStep[] = [
  {
    id: 'project-type',
    index: 0,
    title: "What are we building?",
    description: "Choose the type of project that best fits your vision.",
    hint: "Not sure? Pick the closest match — you can clarify later.",
    estimatedSeconds: 20,
    schema: step0Schema,
    fields: [
      {
        type: 'card-select',
        name: 'type',
        required: true,
        columns: 3,
        options: ORDER_TYPES,
      },
    ],
  },

  {
    id: 'project-goals',
    index: 1,
    title: "What should this project achieve?",
    description: "Select everything that applies. This helps us shape the right strategy.",
    estimatedSeconds: 30,
    schema: step1Schema,
    fields: [
      {
        type: 'chip-multiselect',
        name: 'goals',
        required: true,
        min: 1,
        max: 5,
        options: GOALS,
      },
    ],
  },

  {
    id: 'existing-presence',
    index: 2,
    title: "Do you have an existing website?",
    description: "This helps us understand the starting point.",
    estimatedSeconds: 20,
    schema: step2Schema,
    fields: [
      {
        type: 'card-select',
        name: 'has_existing_site',
        required: true,
        columns: 2,
        options: [
          { value: 'false', label: 'Starting fresh', description: 'No existing website' },
          { value: 'true', label: 'Redesign / improve', description: 'I have a site already' },
        ],
      },
      {
        type: 'conditional-text-input',
        name: 'existing_site_url',
        label: 'Current website URL',
        placeholder: 'https://yoursite.com',
        condition: (values) => values.has_existing_site === true,
        inner: {
          type: 'url-input',
          name: 'existing_site_url',
          label: 'Current website URL',
          placeholder: 'https://yoursite.com',
        },
      },
    ],
  },

  {
    id: 'scope',
    index: 3,
    title: "What pages and features do you need?",
    description: "Give us a sense of the project scope.",
    estimatedSeconds: 45,
    schema: step3Schema,
    // Only show page_count for website/ecommerce — not webapp
    shouldShow: (values) => ['WEBSITE', 'LANDING_PAGE', 'ECOMMERCE', 'REDESIGN'].includes(values.type!),
    fields: [
      {
        type: 'number-input',
        name: 'page_count',
        label: 'How many pages?',
        placeholder: '8',
        helperText: 'Approximate is fine — Home, About, Services, etc.',
      },
      {
        type: 'chip-multiselect',
        name: 'features',
        label: 'Required features',
        options: FEATURES,
        min: 0,
      },
    ],
  },

  {
    id: 'design-style',
    index: 4,
    title: "What's the visual direction?",
    description: "Pick the aesthetic that best represents your brand.",
    estimatedSeconds: 30,
    schema: step4Schema,
    fields: [
      {
        type: 'card-select',
        name: 'design_style',
        required: true,
        columns: 3,
        options: DESIGN_STYLES,
      },
      {
        type: 'url-input',
        name: 'inspiration_urls',
        label: 'Inspiration websites (optional)',
        placeholder: 'https://site-i-love.com',
        required: false,
        helperText: 'Drop up to 3 URLs of designs you admire.',
      },
    ],
  },

  {
    id: 'timeline',
    index: 5,
    title: "When do you need this?",
    description: "Knowing your timeline helps us plan resources.",
    estimatedSeconds: 20,
    schema: step5Schema,
    fields: [
      {
        type: 'card-select',
        name: 'timeline_preference',
        required: true,
        columns: 2,
        options: TIMELINES,
      },
    ],
  },

  {
    id: 'budget',
    index: 6,
    title: "What's your investment range?",
    description: "We're transparent about pricing — this helps us propose the right solution.",
    hint: "All budgets welcome. We'll tell you honestly if something isn't feasible.",
    estimatedSeconds: 20,
    schema: step6Schema,
    fields: [
      {
        type: 'slider',
        name: 'budget_band',
        required: true,
        min: 0,
        max: 5,
        step: 1,
        labels: {
          0: '< €2k',
          1: '€2k – 5k',
          2: '€5k – 10k',
          3: '€10k – 20k',
          4: '€20k – 50k',
          5: '€50k+',
        },
      },
    ],
  },

  {
    id: 'contact',
    index: 7,
    title: "How do we reach you?",
    description: "We'll send your project summary and follow up within 24 hours.",
    estimatedSeconds: 60,
    schema: step7Schema,
    fields: [
      {
        type: 'text-input',
        name: 'contact_name',
        label: 'Your name',
        placeholder: 'Anna Schmidt',
        required: true,
      },
      {
        type: 'email-input',
        name: 'contact_email',
        label: 'Email address',
        placeholder: 'anna@company.com',
        required: true,
      },
      {
        type: 'text-input',
        name: 'company_name',
        label: 'Company name',
        placeholder: 'Acme GmbH',
        required: false,
      },
      {
        type: 'text-input',
        name: 'contact_phone',
        label: 'Phone number',
        placeholder: '+49 ...',
        required: false,
        helperText: 'Optional — only if you prefer a call.',
      },
    ],
  },

  {
    id: 'details',
    index: 8,
    title: "Anything else we should know?",
    description: "The more context you share, the better we can prepare.",
    optional: true,
    estimatedSeconds: 90,
    schema: step8Schema,
    fields: [
      {
        type: 'textarea',
        name: 'description',
        label: 'Project description',
        placeholder: "Tell us about your business, target audience, competitors, and any specific requirements...",
        rows: 6,
        maxLength: 2000,
        required: false,
      },
    ],
  },
];

export const TOTAL_STEPS = ORDER_STEPS.length;
export const REQUIRED_STEPS = ORDER_STEPS.filter((s) => !s.optional);