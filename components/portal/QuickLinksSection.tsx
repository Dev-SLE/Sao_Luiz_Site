import {
  FileText,
  Clock,
  CalendarDays,
  GraduationCap,
  Trophy,
  FolderOpen,
  UserCircle,
  MessageSquare,
  ClipboardList,
} from 'lucide-react';
import Link from 'next/link';

const links = [
  { icon: Clock, label: 'Consulta de Ponto', description: 'Confira seus registros', color: 'bg-blue-500/10 text-blue-600', href: '/meu-ponto' },
  { icon: CalendarDays, label: 'Escala de Trabalho', description: 'Veja sua escala', color: 'bg-emerald-500/10 text-emerald-600', href: '/minha-escala' },
  { icon: FileText, label: 'Holerite', description: 'Seus demonstrativos', color: 'bg-purple-500/10 text-purple-600', href: '/holerite' },
  { icon: GraduationCap, label: 'Treinamentos', description: 'Capacitações disponíveis', color: 'bg-amber-500/10 text-amber-600', href: '/treinamentos' },
  { icon: FolderOpen, label: 'Documentos', description: 'Políticas e normas', color: 'bg-cyan-500/10 text-cyan-600', href: '/documentos' },
  { icon: Trophy, label: 'Campanhas', description: 'Reconhecimento e prêmios', color: 'bg-rose-500/10 text-rose-600', href: '/campanhas' },
  { icon: UserCircle, label: 'Meu Perfil', description: 'Dados pessoais', color: 'bg-indigo-500/10 text-indigo-600', href: '/perfil' },
  { icon: MessageSquare, label: 'Ouvidoria', description: 'Canal de comunicação', color: 'bg-teal-500/10 text-teal-600', href: '/suporte' },
  {
    icon: ClipboardList,
    label: 'Solicitações',
    description: 'Pedidos internos',
    color: 'bg-orange-500/10 text-orange-600',
    href: '/solicitacoes',
  },
];

export function QuickLinksSection() {
  return (
    <section id="atalhos" className="px-6 py-20">
      <div className="mx-auto max-w-7xl">
        <div className="mb-14 text-center">
          <p className="mb-2 font-heading text-sm font-semibold uppercase tracking-widest text-sl-red">Acesso Rápido</p>
          <h2 className="font-heading text-3xl font-bold text-foreground md:text-4xl">O que você precisa, na palma da mão</h2>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
          {links.map((link, index) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.label}
                href={link.href}
                className="group flex animate-fade-in-up flex-col items-center rounded-2xl border border-border bg-card p-6 text-center transition-all duration-300 hover:translate-y-[-4px] hover:border-sl-navy/20 hover:shadow-xl md:p-8"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <div
                  className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110 ${link.color}`}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <span className="font-heading text-sm font-semibold text-foreground">{link.label}</span>
                <span className="mt-1 text-xs text-muted-foreground">{link.description}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
