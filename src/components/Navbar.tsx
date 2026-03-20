import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dumbbell } from "lucide-react";

export default function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/30 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between section-padding">
        <Link to="/" className="flex items-center gap-2 font-display text-xl font-bold tracking-tight">
          <Dumbbell className="h-6 w-6 text-primary" />
          <span>FIT AI</span>
          <span className="text-primary">SYSTEM</span>
        </Link>

        <div className="flex items-center gap-3">
          <Link to="/login">
            <Button variant="ghost" size="sm">Iniciar sesión</Button>
          </Link>
          <Link to="/registro">
            <Button size="sm">Empezar ahora</Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}
