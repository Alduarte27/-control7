import Link from 'next/link';
import { Factory, Save, History, LayoutDashboard, Settings, Download, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/components/theme-provider';

type HeaderProps = {
  onSave: () => void;
  onExport: () => void;
  hasUnsavedChanges: boolean;
};

export default function Header({ onSave, onExport, hasUnsavedChanges }: HeaderProps) {
  const { theme, setTheme } = useTheme();

  return (
    <header className="flex items-center justify-between p-4 border-b bg-card sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <Factory className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Control 7</h1>
      </div>
      <div className="flex items-center gap-2">
        <Button
            variant="outline"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
            <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
        </Button>
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
        <Button onClick={onExport} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV
        </Button>
        <Button onClick={onSave}>
          <Save className="mr-2 h-4 w-4" />
          Guardar Plan
          {hasUnsavedChanges && <span className="ml-2 h-2 w-2 rounded-full bg-blue-500"></span>}
        </Button>
      </div>
    </header>
  );
}
