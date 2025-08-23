import { Factory, Save } from 'lucide-react';
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
      <Button onClick={onSave}>
        <Save className="mr-2 h-4 w-4" />
        Guardar Plan
      </Button>
    </header>
  );
}
