"use client";
import React from 'react';
import { motion } from 'framer-motion';

interface ProjectCardProps {
  project: {
    id: number;
    title: string;
    desc: string;
    image: string;
    tags: string[];
  };
  isActive: boolean;
}

export default function ProjectCard({ project, isActive }: ProjectCardProps) {
  return (
    <motion.div
      whileHover={{ y: -10 }}
      transition={{ type: "spring", stiffness: 300 }}
      className={`motion-reduce:transform-none! cursor-pointer transition-all duration-500 ${isActive ? 'scale-100' : 'scale-90 opacity-60'}`}
    >
      <div 
        className="rounded-2xl overflow-hidden border transition-all duration-300 shadow-soft"
        style={{
          backgroundColor: 'var(--color-surface-1)',
          borderColor: isActive ? 'var(--color-primary)' : 'var(--color-border-soft)',
          boxShadow: isActive ? 'var(--shadow-glow)' : 'var(--shadow-soft)',
        }}
      >
        <div 
          className="h-56 flex items-center justify-center text-7xl relative"
          style={{ background: 'var(--gradient-primary)', opacity: 0.1 }}
        >
          <span className={`transition-all duration-300 ${isActive ? 'text-8xl' : 'text-6xl'}`}>
            {project.image}
          </span>
          {isActive && (
            <div 
              className="absolute inset-0"
              style={{ background: 'linear-gradient(to top, var(--color-primary), transparent)', opacity: 0.1 }}
            />
          )}
        </div>

        <div className="p-6">
          <h3 
            className="text-xl font-bold mb-2 transition-colors"
            style={{ color: isActive ? 'var(--color-primary)' : 'var(--color-text-primary)' }}
          >
            {project.title}
          </h3>
          <p className="text-sm mb-4 line-clamp-2" style={{ color: 'var(--color-text-secondary)' }}>
            {project.desc}
          </p>
          <div className="flex flex-wrap gap-2">
            {project.tags.slice(0, 3).map((tag) => (
              <span 
                key={tag} 
                className="px-2.5 py-1 text-xs rounded-full transition-all"
                style={{
                  backgroundColor: isActive ? 'rgba(1, 202, 224, 0.2)' : 'var(--color-surface-2)',
                  color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  border: isActive ? `1px solid var(--color-primary)` : 'none',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {isActive && (
          <div 
            className="absolute bottom-0 left-0 right-0 h-0.5"
            style={{ background: 'var(--gradient-primary)' }}
          />
        )}
      </div>
    </motion.div>
  );
}
