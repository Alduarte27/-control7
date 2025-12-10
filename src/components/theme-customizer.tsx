
'use client';

import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { useTheme } from 'next-themes';
import { Check, Moon, Palette, Sun, Undo2, Type } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Label } from './ui/label';
import { Slider } from './ui/slider';
import { Card } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ScrollArea } from './ui/scroll-area';


type ThemeColors = {
  background: string;
  foreground: string;
  card: string;
  primary: string;
  'primary-foreground': string;
  secondary: string;
  'secondary-foreground': string;
  muted: string;
  'muted-foreground': string;
  accent: string;
  'accent-foreground': string;
  destructive: string;
  'destructive-foreground': string;
  border: string;
  input: string;
  ring: string;
};

type Theme = {
  name: string;
  light: ThemeColors;
  dark: ThemeColors;
};


const themes: Theme[] = [
  {
    name: 'Violeta Profundo',
    light: {
      background: '270 44% 97%',
      foreground: '261 39% 15%',
      card: '0 0% 100%',
      primary: '261 39% 48%',
      'primary-foreground': '0 0% 98%',
      secondary: '270 44% 94%',
      'secondary-foreground': '261 39% 48%',
      muted: '270 44% 94%',
      'muted-foreground': '261 39% 40%',
      accent: '211 29% 85%',
      'accent-foreground': '211 29% 25%',
      destructive: '0 84.2% 60.2%',
      'destructive-foreground': '0 0% 98%',
      border: '270 44% 90%',
      input: '270 44% 85%',
      ring: '261 39% 48%',
    },
    dark: {
      background: '261 39% 10%',
      foreground: '0 0% 98%',
      card: '261 39% 12%',
      primary: '261 39% 68%',
      'primary-foreground': '261 39% 15%',
      secondary: '270 44% 15%',
      'secondary-foreground': '0 0% 98%',
      muted: '270 44% 15%',
      'muted-foreground': '0 0% 63.9%',
      accent: '211 29% 30%',
      'accent-foreground': '0 0% 98%',
      destructive: '0 62.8% 30.6%',
      'destructive-foreground': '0 0% 98%',
      border: '270 44% 20%',
      input: '270 44% 22%',
      ring: '261 39% 68%',
    },
  },
  {
    name: 'Océano Nocturno',
    light: {
      background: '216 33% 97%',
      foreground: '222 47% 11%',
      card: '0 0% 100%',
      primary: '217 91% 60%',
      'primary-foreground': '210 40% 98%',
      secondary: '210 40% 96.1%',
      'secondary-foreground': '222 47% 11.2%',
      muted: '210 40% 96.1%',
      'muted-foreground': '215.4 16.3% 46.9%',
      accent: '210 40% 98%',
      'accent-foreground': '222.2 47.4% 11.2%',
      destructive: '0 84.2% 60.2%',
      'destructive-foreground': '210 40% 98%',
      border: '214.3 31.8% 91.4%',
      input: '214.3 31.8% 91.4%',
      ring: '217 91% 60%',
    },
    dark: {
      background: '224 71% 4%',
      foreground: '213 31% 91%',
      card: '224 71% 6%',
      primary: '217 91% 60%',
      'primary-foreground': '210 40% 98%',
      secondary: '215 28% 17%',
      'secondary-foreground': '213 31% 91%',
      muted: '215 28% 17%',
      'muted-foreground': '218 11% 65%',
      accent: '215 20% 25%',
      'accent-foreground': '213 31% 91%',
      destructive: '0 63% 31%',
      'destructive-foreground': '213 31% 91%',
      border: '215 28% 17%',
      input: '215 28% 17%',
      ring: '217 91% 60%',
    },
  },
  {
    name: 'Bosque Esmeralda',
    light: {
      background: '120 60% 97%',
      foreground: '148 14% 10%',
      card: '0 0% 100%',
      primary: '142 76% 36%',
      'primary-foreground': '143 71% 95%',
      secondary: '140 40% 96%',
      'secondary-foreground': '148 14% 10%',
      muted: '140 40% 96%',
      'muted-foreground': '148 10% 45%',
      accent: '140 30% 92%',
      'accent-foreground': '148 14% 10%',
      destructive: '0 84% 60%',
      'destructive-foreground': '0 0% 98%',
      border: '140 30% 90%',
      input: '140 30% 90%',
      ring: '142 76% 36%',
    },
    dark: {
      background: '150 14% 10%',
      foreground: '143 13% 90%',
      card: '150 14% 12%',
      primary: '143 71% 45%',
      'primary-foreground': '143 71% 95%',
      secondary: '147 13% 17%',
      'secondary-foreground': '143 13% 90%',
      muted: '147 13% 17%',
      'muted-foreground': '147 9% 55%',
      accent: '147 11% 25%',
      'accent-foreground': '143 13% 90%',
      destructive: '0 63% 31%',
      'destructive-foreground': '0 0% 98%',
      border: '147 13% 17%',
      input: '147 13% 17%',
      ring: '143 71% 45%',
    },
  },
  {
    name: 'Amanecer',
    light: {
      background: '30 100% 97%',
      foreground: '25 25% 15%',
      card: '0 0% 100%',
      primary: '24 9.8% 30%',
      'primary-foreground': '40 100% 98%',
      secondary: '30 60% 94%',
      'secondary-foreground': '25 25% 15%',
      muted: '30 60% 94%',
      'muted-foreground': '25 20% 45%',
      accent: '35 80% 88%',
      'accent-foreground': '25 25% 15%',
      destructive: '0 84% 60%',
      'destructive-foreground': '0 0% 98%',
      border: '30 50% 90%',
      input: '30 50% 88%',
      ring: '24 9.8% 30%',
    },
    dark: {
      background: '20 18% 10%',
      foreground: '30 20% 90%',
      card: '20 18% 12%',
      primary: '35 86% 65%',
      'primary-foreground': '20 18% 10%',
      secondary: '30 15% 18%',
      'secondary-foreground': '30 20% 90%',
      muted: '30 15% 18%',
      'muted-foreground': '30 15% 60%',
      accent: '30 15% 25%',
      'accent-foreground': '30 20% 90%',
      destructive: '0 70% 40%',
      'destructive-foreground': '0 0% 98%',
      border: '30 15% 18%',
      input: '30 15% 18%',
      ring: '35 86% 65%',
    },
  },
  {
    name: 'Pizarra',
    light: {
      background: '220 10% 97%',
      foreground: '220 15% 10%',
      card: '0 0% 100%',
      primary: '220 15% 25%',
      'primary-foreground': '0 0% 98%',
      secondary: '220 10% 94%',
      'secondary-foreground': '220 15% 10%',
      muted: '220 10% 94%',
      'muted-foreground': '220 10% 45%',
      accent: '220 10% 88%',
      'accent-foreground': '220 15% 10%',
      destructive: '0 84% 60%',
      'destructive-foreground': '0 0% 98%',
      border: '220 10% 90%',
      input: '220 10% 88%',
      ring: '220 15% 25%',
    },
    dark: {
      background: '220 15% 10%',
      foreground: '220 10% 90%',
      card: '220 15% 12%',
      primary: '210 10% 80%',
      'primary-foreground': '220 15% 10%',
      secondary: '220 10% 18%',
      'secondary-foreground': '220 10% 90%',
      muted: '220 10% 18%',
      'muted-foreground': '220 10% 60%',
      accent: '220 10% 25%',
      'accent-foreground': '220 10% 90%',
      destructive: '0 70% 40%',
      'destructive-foreground': '0 0% 98%',
      border: '220 10% 18%',
      input: '220 10% 18%',
      ring: '210 10% 80%',
    },
  },
  {
    name: 'Industrial',
    light: {
      background: '0 0% 94%',
      foreground: '240 10% 3.9%',
      card: '0 0% 100%',
      primary: '240 5.9% 10%',
      'primary-foreground': '0 0% 98%',
      secondary: '0 0% 96.1%',
      'secondary-foreground': '240 5.9% 10%',
      muted: '0 0% 96.1%',
      'muted-foreground': '240 3.8% 46.1%',
      accent: '0 0% 98%',
      'accent-foreground': '240 5.9% 10%',
      destructive: '0 84.2% 60.2%',
      'destructive-foreground': '0 0% 98%',
      border: '0 0% 89.8%',
      input: '0 0% 89.8%',
      ring: '240 5.9% 10%',
    },
    dark: {
      background: '240 10% 3.9%',
      foreground: '0 0% 98%',
      card: '240 10% 3.9%',
      primary: '0 0% 98%',
      'primary-foreground': '240 5.9% 10%',
      secondary: '240 3.7% 15.9%',
      'secondary-foreground': '0 0% 98%',
      muted: '240 3.7% 15.9%',
      'muted-foreground': '240 5% 64.9%',
      accent: '240 3.7% 15.9%',
      'accent-foreground': '0 0% 98%',
      destructive: '0 62.8% 30.6%',
      'destructive-foreground': '0 0% 98%',
      border: '240 3.7% 15.9%',
      input: '240 3.7% 15.9%',
      ring: '0 0% 98%',
    },
  },
  {
    name: 'Rubí Intenso',
    light: {
      background: '0 100% 97%',
      foreground: '0 40% 15%',
      card: '0 0% 100%',
      primary: '0 72% 51%',
      'primary-foreground': '0 0% 98%',
      secondary: '0 80% 96%',
      'secondary-foreground': '0 72% 51%',
      muted: '0 80% 96%',
      'muted-foreground': '0 50% 40%',
      accent: '0 75% 90%',
      'accent-foreground': '0 40% 15%',
      destructive: '0 84% 60%',
      'destructive-foreground': '0 0% 98%',
      border: '0 70% 92%',
      input: '0 70% 92%',
      ring: '0 72% 51%',
    },
    dark: {
      background: '0 40% 8%',
      foreground: '0 20% 90%',
      card: '0 40% 10%',
      primary: '0 80% 65%',
      'primary-foreground': '0 40% 8%',
      secondary: '0 30% 15%',
      'secondary-foreground': '0 20% 90%',
      muted: '0 30% 15%',
      'muted-foreground': '0 20% 60%',
      accent: '0 30% 25%',
      'accent-foreground': '0 20% 90%',
      destructive: '0 70% 40%',
      'destructive-foreground': '0 0% 98%',
      border: '0 30% 15%',
      input: '0 30% 15%',
      ring: '0 80% 65%',
    },
  },
  {
    name: 'Rosa Cuarzo',
    light: {
      background: '350 100% 97%',
      foreground: '350 40% 15%',
      card: '0 0% 100%',
      primary: '347 77% 50%',
      'primary-foreground': '0 0% 98%',
      secondary: '350 80% 96%',
      'secondary-foreground': '347 77% 50%',
      muted: '350 80% 96%',
      'muted-foreground': '350 50% 40%',
      accent: '350 75% 90%',
      'accent-foreground': '350 40% 15%',
      destructive: '0 84% 60%',
      'destructive-foreground': '0 0% 98%',
      border: '350 70% 92%',
      input: '350 70% 92%',
      ring: '347 77% 50%',
    },
    dark: {
      background: '350 40% 8%',
      foreground: '350 20% 90%',
      card: '350 40% 10%',
      primary: '347 90% 70%',
      'primary-foreground': '350 40% 8%',
      secondary: '350 30% 15%',
      'secondary-foreground': '350 20% 90%',
      muted: '350 30% 15%',
      'muted-foreground': '350 20% 60%',
      accent: '350 30% 25%',
      'accent-foreground': '350 20% 90%',
      destructive: '0 70% 40%',
      'destructive-foreground': '0 0% 98%',
      border: '350 30% 15%',
      input: '350 30% 15%',
      ring: '347 90% 70%',
    },
  },
  {
    name: 'Cielo de Verano',
    light: {
      background: '195 100% 97%',
      foreground: '195 40% 15%',
      card: '0 0% 100%',
      primary: '190 81% 48%',
      'primary-foreground': '0 0% 98%',
      secondary: '195 80% 96%',
      'secondary-foreground': '190 81% 48%',
      muted: '195 80% 96%',
      'muted-foreground': '195 50% 40%',
      accent: '195 75% 90%',
      'accent-foreground': '195 40% 15%',
      destructive: '0 84% 60%',
      'destructive-foreground': '0 0% 98%',
      border: '195 70% 92%',
      input: '195 70% 92%',
      ring: '190 81% 48%',
    },
    dark: {
      background: '195 40% 8%',
      foreground: '195 20% 90%',
      card: '195 40% 10%',
      primary: '190 90% 70%',
      'primary-foreground': '195 40% 8%',
      secondary: '195 30% 15%',
      'secondary-foreground': '195 20% 90%',
      muted: '195 30% 15%',
      'muted-foreground': '195 20% 60%',
      accent: '195 30% 25%',
      'accent-foreground': '195 20% 90%',
      destructive: '0 70% 40%',
      'destructive-foreground': '0 0% 98%',
      border: '195 30% 15%',
      input: '195 30% 15%',
      ring: '190 90% 70%',
    },
  },
  {
    name: 'Menta Fresca',
    light: {
      background: '165 100% 97%',
      foreground: '165 40% 15%',
      card: '0 0% 100%',
      primary: '160 81% 40%',
      'primary-foreground': '0 0% 98%',
      secondary: '165 80% 96%',
      'secondary-foreground': '160 81% 40%',
      muted: '165 80% 96%',
      'muted-foreground': '165 50% 40%',
      accent: '165 75% 90%',
      'accent-foreground': '165 40% 15%',
      destructive: '0 84% 60%',
      'destructive-foreground': '0 0% 98%',
      border: '165 70% 92%',
      input: '165 70% 92%',
      ring: '160 81% 40%',
    },
    dark: {
      background: '165 40% 8%',
      foreground: '165 20% 90%',
      card: '165 40% 10%',
      primary: '160 90% 65%',
      'primary-foreground': '165 40% 8%',
      secondary: '165 30% 15%',
      'secondary-foreground': '165 20% 90%',
      muted: '165 30% 15%',
      'muted-foreground': '165 20% 60%',
      accent: '165 30% 25%',
      'accent-foreground': '165 20% 90%',
      destructive: '0 70% 40%',
      'destructive-foreground': '0 0% 98%',
      border: '165 30% 15%',
      input: '165 30% 15%',
      ring: '160 90% 65%',
    },
  },
   {
    name: 'Grafito',
    light: {
      background: '220 14% 96%',
      foreground: '220 14% 10%',
      card: '0 0% 100%',
      primary: '220 14% 25%',
      'primary-foreground': '0 0% 98%',
      secondary: '220 14% 94%',
      'secondary-foreground': '220 14% 10%',
      muted: '220 14% 94%',
      'muted-foreground': '220 14% 45%',
      accent: '220 14% 88%',
      'accent-foreground': '220 14% 10%',
      destructive: '0 84% 60%',
      'destructive-foreground': '0 0% 98%',
      border: '220 14% 90%',
      input: '220 14% 88%',
      ring: '220 14% 25%',
    },
    dark: {
      background: '220 14% 5%',
      foreground: '220 14% 90%',
      card: '220 14% 8%',
      primary: '210 90% 70%',
      'primary-foreground': '220 14% 5%',
      secondary: '220 14% 15%',
      'secondary-foreground': '220 14% 90%',
      muted: '220 14% 15%',
      'muted-foreground': '220 14% 60%',
      accent: '220 14% 25%',
      'accent-foreground': '220 14% 90%',
      destructive: '0 70% 40%',
      'destructive-foreground': '0 0% 98%',
      border: '220 14% 15%',
      input: '220 14% 15%',
      ring: '210 90% 70%',
    },
  },
  {
    name: 'Tierra',
    light: {
      background: '30 25% 96%',
      foreground: '30 25% 10%',
      card: '0 0% 100%',
      primary: '30 65% 40%',
      'primary-foreground': '0 0% 98%',
      secondary: '30 30% 94%',
      'secondary-foreground': '30 25% 10%',
      muted: '30 30% 94%',
      'muted-foreground': '30 25% 45%',
      accent: '30 30% 88%',
      'accent-foreground': '30 25% 10%',
      destructive: '0 84% 60%',
      'destructive-foreground': '0 0% 98%',
      border: '30 30% 90%',
      input: '30 30% 88%',
      ring: '30 65% 40%',
    },
    dark: {
      background: '30 15% 8%',
      foreground: '30 15% 90%',
      card: '30 15% 11%',
      primary: '35 80% 60%',
      'primary-foreground': '30 15% 8%',
      secondary: '30 10% 15%',
      'secondary-foreground': '30 15% 90%',
      muted: '30 10% 15%',
      'muted-foreground': '30 10% 60%',
      accent: '30 10% 25%',
      'accent-foreground': '30 15% 90%',
      destructive: '0 70% 40%',
      'destructive-foreground': '0 0% 98%',
      border: '30 10% 15%',
      input: '30 10% 15%',
      ring: '35 80% 60%',
    },
  },
  {
    name: 'Lavanda',
    light: {
      background: '250 60% 97%',
      foreground: '250 25% 15%',
      card: '0 0% 100%',
      primary: '250 65% 55%',
      'primary-foreground': '0 0% 98%',
      secondary: '250 60% 94%',
      'secondary-foreground': '250 25% 15%',
      muted: '250 60% 94%',
      'muted-foreground': '250 25% 45%',
      accent: '250 60% 88%',
      'accent-foreground': '250 25% 15%',
      destructive: '0 84% 60%',
      'destructive-foreground': '0 0% 98%',
      border: '250 60% 90%',
      input: '250 60% 88%',
      ring: '250 65% 55%',
    },
    dark: {
      background: '250 20% 10%',
      foreground: '250 15% 90%',
      card: '250 20% 13%',
      primary: '250 80% 75%',
      'primary-foreground': '250 20% 10%',
      secondary: '250 15% 18%',
      'secondary-foreground': '250 15% 90%',
      muted: '250 15% 18%',
      'muted-foreground': '250 10% 60%',
      accent: '250 15% 25%',
      'accent-foreground': '250 15% 90%',
      destructive: '0 70% 40%',
      'destructive-foreground': '0 0% 98%',
      border: '250 15% 18%',
      input: '250 15% 18%',
      ring: '250 80% 75%',
    },
  },
  {
    name: 'Cítrico',
    light: {
      background: '50 100% 96%',
      foreground: '45 50% 15%',
      card: '0 0% 100%',
      primary: '40 90% 50%',
      'primary-foreground': '45 50% 10%',
      secondary: '50 80% 94%',
      'secondary-foreground': '45 50% 15%',
      muted: '50 80% 94%',
      'muted-foreground': '45 40% 45%',
      accent: '50 80% 88%',
      'accent-foreground': '45 50% 15%',
      destructive: '0 84% 60%',
      'destructive-foreground': '0 0% 98%',
      border: '50 70% 90%',
      input: '50 70% 88%',
      ring: '40 90% 50%',
    },
    dark: {
      background: '40 20% 8%',
      foreground: '45 30% 90%',
      card: '40 20% 11%',
      primary: '45 90% 60%',
      'primary-foreground': '40 20% 8%',
      secondary: '40 15% 15%',
      'secondary-foreground': '45 30% 90%',
      muted: '40 15% 15%',
      'muted-foreground': '45 20% 60%',
      accent: '40 15% 25%',
      'accent-foreground': '45 30% 90%',
      destructive: '0 70% 40%',
      'destructive-foreground': '0 0% 98%',
      border: '40 15% 15%',
      input: '40 15% 15%',
      ring: '45 90% 60%',
    },
  },
  {
    name: 'Galaxia',
    light: {
      background: '240 20% 96%',
      foreground: '240 20% 10%',
      card: '0 0% 100%',
      primary: '260 80% 55%',
      'primary-foreground': '0 0% 98%',
      secondary: '240 20% 94%',
      'secondary-foreground': '240 20% 10%',
      muted: '240 20% 94%',
      'muted-foreground': '240 20% 45%',
      accent: '260 50% 90%',
      'accent-foreground': '240 20% 10%',
      destructive: '0 84% 60%',
      'destructive-foreground': '0 0% 98%',
      border: '240 20% 90%',
      input: '240 20% 88%',
      ring: '260 80% 55%',
    },
    dark: {
      background: '240 20% 5%',
      foreground: '240 10% 90%',
      card: '260 30% 8%',
      primary: '260 90% 75%',
      'primary-foreground': '240 20% 5%',
      secondary: '260 20% 15%',
      'secondary-foreground': '240 10% 90%',
      muted: '260 20% 15%',
      'muted-foreground': '240 10% 60%',
      accent: '260 20% 25%',
      'accent-foreground': '240 10% 90%',
      destructive: '0 70% 40%',
      'destructive-foreground': '0 0% 98%',
      border: '260 20% 15%',
      input: '260 20% 15%',
      ring: '260 90% 75%',
    },
  },
];


const fonts = [
  { name: 'Inter', variable: 'var(--font-inter)' },
  { name: 'Poppins', variable: 'var(--font-poppins)' },
  { name: 'Roboto', variable: 'var(--font-roboto)' },
  { name: 'Lato', variable: 'var(--font-lato)' },
  { name: 'Montserrat', variable: 'var(--font-montserrat)' },
];

type CustomThemeConfig = {
  colors: Partial<ThemeColors>;
  radius: number;
  font: string;
};

export default function ThemeCustomizer({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const { theme: mode, setTheme } = useTheme();
  const [activeTheme, setActiveTheme] = useState('Violeta Profundo');
  const [activeFont, setActiveFont] = useState('Inter');
  const [activeRadius, setActiveRadius] = useState(0.5);

  const applyTheme = (config: Partial<CustomThemeConfig>) => {
    const root = document.documentElement;
    if (config.colors) {
      for (const [key, value] of Object.entries(config.colors)) {
        root.style.setProperty(`--${key}`, value);
      }
    }
    if (config.radius !== undefined) {
      root.style.setProperty('--radius', `${config.radius}rem`);
    }
     if (config.font) {
      const fontVariable = fonts.find(f => f.name === config.font)?.variable;
      if (fontVariable) {
          root.style.setProperty('--font-sans', fontVariable);
      }
    }
  };

  const handlePresetSelect = (themeName: string) => {
    const selected = themes.find(t => t.name === themeName);
    if (!selected) return;

    // Use the current mode from useTheme, which is reliable.
    const colors = mode === 'dark' ? selected.dark : selected.light;
    
    applyTheme({ colors });
    setActiveTheme(themeName);
    localStorage.setItem('control7-theme-preset', themeName);
  };
  
  const handleRadiusChange = (value: number[]) => {
      const newRadius = value[0];
      applyTheme({ radius: newRadius });
      setActiveRadius(newRadius);
      localStorage.setItem('control7-radius', String(newRadius));
  };
  
  const handleFontChange = (fontName: string) => {
    applyTheme({ font: fontName });
    setActiveFont(fontName);
    localStorage.setItem('control7-font', fontName);
  }

  const handleReset = () => {
    localStorage.removeItem('control7-theme-preset');
    localStorage.removeItem('control7-radius');
    localStorage.removeItem('control7-font');
    window.location.reload();
  }

  useEffect(() => {
    // This effect runs once on mount to load the stored preferences
    const preset = localStorage.getItem('control7-theme-preset') || 'Violeta Profundo';
    const radius = localStorage.getItem('control7-radius');
    const font = localStorage.getItem('control7-font') || 'Inter';

    const selectedTheme = themes.find(t => t.name === preset);
    if (selectedTheme) {
        // Determine mode based on system preference or stored next-themes value
        const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches && (mode === 'system' || !mode) || mode === 'dark';
        applyTheme({ colors: isDarkMode ? selectedTheme.dark : selectedTheme.light });
        setActiveTheme(preset);
    }
    if (radius) {
        const numRadius = Number(radius);
        applyTheme({ radius: numRadius });
        setActiveRadius(numRadius);
    }
    if (font) {
        applyTheme({ font });
        setActiveFont(font);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const preset = localStorage.getItem('control7-theme-preset') || 'Violeta Profundo';
    const selectedTheme = themes.find(t => t.name === preset);
    
    if (selectedTheme) {
        const colors = mode === 'dark' ? selectedTheme.dark : selectedTheme.light;
        applyTheme({ colors });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Palette/> Personalizar Apariencia</DialogTitle>
          <DialogDescription>
            Elige un tema, tipografía y estilos para adaptar la aplicación a tu gusto.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-8">
            <div className="space-y-3">
                 <h3 className="font-semibold">Temas Recomendados</h3>
                 <ScrollArea className="h-48">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 pr-4">
                        {themes.map((t) => (
                            <Card key={t.name} className="overflow-hidden cursor-pointer" onClick={() => handlePresetSelect(t.name)}>
                            <div className="p-4 space-y-2 relative">
                                <div className="flex -space-x-2">
                                    <div className="w-6 h-6 rounded-full border-2 border-white dark:border-black" style={{ background: `hsl(${t.light.primary})`}}></div>
                                    <div className="w-6 h-6 rounded-full border-2 border-white dark:border-black" style={{ background: `hsl(${t.light.background})`}}></div>
                                    <div className="w-6 h-6 rounded-full border-2 border-white dark:border-black" style={{ background: `hsl(${t.light.accent})`}}></div>
                                </div>
                                <p className="text-sm font-medium">{t.name}</p>
                                {activeTheme === t.name && (
                                    <div className="absolute top-2 right-2 w-5 h-5 bg-primary text-primary-foreground rounded-full flex items-center justify-center">
                                        <Check className="w-3 h-3" />
                                    </div>
                                )}
                            </div>
                            </Card>
                        ))}
                    </div>
                 </ScrollArea>
            </div>

            <div className="space-y-4">
                <h3 className="font-semibold">Tipografía</h3>
                 <Select value={activeFont} onValueChange={handleFontChange}>
                    <SelectTrigger>
                        <div className="flex items-center gap-2">
                            <Type className="h-4 w-4" />
                            <SelectValue />
                        </div>
                    </SelectTrigger>
                    <SelectContent>
                        {fonts.map(font => (
                            <SelectItem key={font.name} value={font.name} style={{ fontFamily: font.variable }}>
                                {font.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

             <div className="space-y-4">
                <h3 className="font-semibold">Apariencia</h3>
                <div className="flex gap-2">
                    <Button variant={mode === 'light' ? 'default' : 'outline'} onClick={() => setTheme('light')} className="flex-1">
                        <Sun className="mr-2 h-4 w-4"/> Claro
                    </Button>
                    <Button variant={mode === 'dark' ? 'default' : 'outline'} onClick={() => setTheme('dark')} className="flex-1">
                        <Moon className="mr-2 h-4 w-4"/> Oscuro
                    </Button>
                </div>
            </div>

            <div className="space-y-4">
                 <h3 className="font-semibold">Bordes</h3>
                 <div className="space-y-2">
                    <Label>Radio del Borde</Label>
                    <Slider value={[activeRadius]} max={2} min={0} step={0.1} onValueChange={handleRadiusChange} />
                 </div>
            </div>

            <Button variant="ghost" className="text-sm text-muted-foreground" onClick={handleReset}>
                <Undo2 className="mr-2 h-4 w-4"/> Restaurar a Valores por Defecto
            </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
