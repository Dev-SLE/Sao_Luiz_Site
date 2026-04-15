'use client';

import { useState } from 'react';
import { Play, Clock, BookOpen, CheckCircle2, Lock } from 'lucide-react';

const categories = ['Todos', 'Obrigatórios', 'Segurança', 'Operacional', 'Liderança', 'Bem-Estar'];

const featuredCourse = {
  id: 0,
  title: 'Direção Defensiva — Curso Completo 2026',
  description: 'Capacitação obrigatória para todos os motoristas. Aulas práticas e teóricas com certificação.',
  image: '/portal-assets/hero-trucks.jpg',
  duration: '4h 30min',
  modules: 12,
  category: 'Obrigatórios',
  progress: 65,
};

const courses = [
  {
    id: 1,
    title: 'Segurança no Transporte de Cargas',
    image: '/portal-assets/training-room.jpg',
    duration: '2h 15min',
    modules: 8,
    category: 'Segurança',
    status: 'available' as const,
  },
  {
    id: 2,
    title: 'Primeiros Socorros na Estrada',
    image: '/portal-assets/operations-center.jpg',
    duration: '1h 40min',
    modules: 6,
    category: 'Segurança',
    status: 'completed' as const,
  },
  {
    id: 3,
    title: 'Operação de Empilhadeira — Básico',
    image: '/portal-assets/team-warehouse.jpg',
    duration: '3h',
    modules: 10,
    category: 'Operacional',
    status: 'available' as const,
  },
  {
    id: 4,
    title: 'Liderança na Logística',
    image: '/portal-assets/training-room.jpg',
    duration: '2h 30min',
    modules: 7,
    category: 'Liderança',
    status: 'locked' as const,
  },
  {
    id: 5,
    title: 'Gestão do Estresse e Bem-Estar',
    image: '/portal-assets/operations-center.jpg',
    duration: '1h 20min',
    modules: 5,
    category: 'Bem-Estar',
    status: 'available' as const,
  },
  {
    id: 6,
    title: 'Manuseio de Cargas Perigosas',
    image: '/portal-assets/hero-trucks.jpg',
    duration: '3h 45min',
    modules: 14,
    category: 'Obrigatórios',
    status: 'available' as const,
  },
  {
    id: 7,
    title: 'Comunicação Efetiva para Equipes',
    image: '/portal-assets/team-warehouse.jpg',
    duration: '1h 50min',
    modules: 6,
    category: 'Liderança',
    status: 'available' as const,
  },
  {
    id: 8,
    title: 'Ergonomia no Ambiente de Trabalho',
    image: '/portal-assets/training-room.jpg',
    duration: '45min',
    modules: 3,
    category: 'Bem-Estar',
    status: 'completed' as const,
  },
];

export function TreinamentosPageContent() {
  const [activeCategory, setActiveCategory] = useState('Todos');

  const filtered = activeCategory === 'Todos' ? courses : courses.filter((c) => c.category === activeCategory);

  return (
    <div className="min-h-screen bg-background">
      <div className="pt-16">
        <div className="relative flex min-h-[400px] h-[50vh] items-end overflow-hidden">
          <img src={featuredCourse.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-sl-navy via-sl-navy/60 to-sl-navy/20" />
          <div className="relative z-10 mx-auto w-full max-w-7xl px-6 pb-12">
            <span className="mb-4 inline-flex items-center rounded-full bg-sl-red px-3 py-1 text-xs font-semibold text-white">
              {featuredCourse.category}
            </span>
            <h1 className="mb-3 max-w-2xl font-heading text-3xl font-bold leading-tight text-white md:text-5xl">
              {featuredCourse.title}
            </h1>
            <p className="mb-6 max-w-xl text-base text-white/70">{featuredCourse.description}</p>
            <div className="mb-6 flex flex-wrap items-center gap-6">
              <span className="flex items-center gap-2 text-sm text-white/60">
                <Clock className="h-4 w-4" /> {featuredCourse.duration}
              </span>
              <span className="flex items-center gap-2 text-sm text-white/60">
                <BookOpen className="h-4 w-4" /> {featuredCourse.modules} módulos
              </span>
            </div>
            <div className="flex items-center gap-4">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg bg-sl-red px-6 py-3 font-heading text-sm font-semibold text-white transition-all duration-300 hover:translate-y-[-2px] hover:bg-sl-red-light hover:shadow-lg"
              >
                <Play className="h-4 w-4 fill-white" /> Continuar assistindo
              </button>
              <div className="hidden items-center gap-3 sm:flex">
                <div className="h-2 w-32 overflow-hidden rounded-full bg-white/20">
                  <div className="h-full rounded-full bg-sl-red" style={{ width: `${featuredCourse.progress}%` }} />
                </div>
                <span className="text-xs text-white/60">{featuredCourse.progress}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="sticky top-16 z-30 border-b border-border bg-background">
        <div className="mx-auto max-w-7xl px-6">
          <div className="scrollbar-hide flex gap-1 overflow-x-auto py-3">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
                  activeCategory === cat ? 'bg-sl-navy text-white' : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-12">
        <h2 className="mb-8 font-heading text-2xl font-bold text-foreground">Todos os treinamentos</h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {filtered.map((course) => (
            <article
              key={course.id}
              className="group cursor-pointer overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:translate-y-[-4px] hover:border-sl-navy/20 hover:shadow-xl"
            >
              <div className="relative aspect-[16/10] overflow-hidden">
                <img
                  src={course.image}
                  alt={course.title}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                {course.status === 'completed' && (
                  <div className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500">
                    <CheckCircle2 className="h-4 w-4 text-white" />
                  </div>
                )}
                {course.status === 'locked' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-sl-navy/60">
                    <Lock className="h-8 w-8 text-white/60" />
                  </div>
                )}
                {course.status !== 'locked' && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sl-red/90">
                      <Play className="ml-0.5 h-5 w-5 fill-white text-white" />
                    </div>
                  </div>
                )}
              </div>
              <div className="p-5">
                <span className="text-xs font-semibold text-sl-red">{course.category}</span>
                <h3 className="mt-1 mb-3 line-clamp-2 font-heading text-sm font-semibold leading-snug text-foreground transition-colors group-hover:text-sl-navy-light">
                  {course.title}
                </h3>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> {course.duration}
                  </span>
                  <span className="flex items-center gap-1">
                    <BookOpen className="h-3.5 w-3.5" /> {course.modules} módulos
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
