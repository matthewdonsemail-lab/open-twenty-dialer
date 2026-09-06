import React from 'react';
import { cn } from '@/lib/utils';

type BadgeVariant = 'blue' | 'green' | 'amber' | 'red' | 'gray' | 'purple';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  className?: string;
  children: React.ReactNode;
}

const variantClasses: Record<BadgeVariant, string> = {
  blue: 'bg-blue-100 text-blue-800',
  green: 'bg-green-100 text-green-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-800',
  gray: 'bg-gray-100 text-gray-800',
  purple: 'bg-purple-100 text-purple-800',
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-0.5',
};

export function Badge({
  variant = 'gray',
  size = 'md',
  className,
  children,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-semibold',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {children}
    </span>
  );
}
