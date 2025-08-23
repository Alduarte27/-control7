import Link from 'next/link';
import { Factory, Save, History, LayoutDashboard, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

type HeaderProps = {
  onSave: () => void;
};

export default function Header({ onSave }: HeaderProps) {
  return (
    <header className="flex items-center justify-between p-4 border-b bg-card sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <Factory className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Control 7</h1>
      </div>
      <div className="flex items-center gap-2">
        <Link href="/dashboard">
          <Button variant="outline">
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Dashboard
          </Button>
        </Link>
        <Link href="/history">
          <Button variant="outline">
            <History className="mr-2 h-4 w-4" />
            Historial
          </Button>
        </Link>
        <Link href="/admin">
          <Button variant="outline">
            <Settings className="mr-2 h-4 w-4" />
            Administración
          </Button>
        </Link>
        <Button onClick={onSave}>
          <Save className="mr-2 h-4 w-4" />
          Guardar Plan
        </Button>
      </div>
    </header>
  );
}
