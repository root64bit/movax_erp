/**
 * Stitch Design System Configuration
 * Connected to Stitch Project: 786368460448211335
 * Project Name: Movax ERP / POS
 */

export const STITCH_CONFIG = {
  projectId: "786368460448211335",
  title: "Movax ERP / POS",
  visibility: "PUBLIC",
  deviceType: "DESKTOP",
  
  theme: {
    fontFamily: "Inter, sans-serif",
    currency: "MZN",
    dateFormat: "DD/MM/AAAA",
    
    colors: {
      primary: "#001e40",
      primaryContainer: "#003366",
      onPrimary: "#ffffff",
      onPrimaryContainer: "#799dd6",
      
      secondary: "#006e25", // Guardar / Confirmar
      secondaryContainer: "#80f98b",
      onSecondary: "#ffffff",
      onSecondaryContainer: "#007327",
      
      tertiary: "#450009",
      tertiaryContainer: "#6d0014",
      
      error: "#ba1a1a", // Cancelar / Stock Crítico
      errorContainer: "#ffdad6",
      onError: "#ffffff",
      onErrorContainer: "#93000a",
      
      background: "#f8f9fa",
      surface: "#f8f9fa",
      surfaceBright: "#f8f9fa",
      surfaceContainerLowest: "#ffffff",
      surfaceContainerLow: "#f3f4f5",
      surfaceContainer: "#edeeef",
      surfaceContainerHigh: "#e7e8e9",
      surfaceContainerHighest: "#e1e3e4",
      
      onSurface: "#191c1d",
      onSurfaceVariant: "#43474f",
      outline: "#737780",
      outlineVariant: "#c3c6d1",
    },
    
    rounded: {
      sm: "0.125rem",
      default: "0.25rem",
      md: "0.375rem",
      lg: "0.5rem",
      xl: "0.75rem",
      full: "9999px"
    }
  },

  screens: [
    {
      id: "514df40d59ff48cb9e2199a96fdffb1f",
      title: "Início - Movax",
      route: "dashboard"
    },
    {
      id: "5e21e469189844468a8eddae836ea87d",
      title: "Artigos e Stock - Movax",
      route: "inventory"
    },
    {
      id: "0587efb8ca494de9983bb568e3b16225",
      title: "Nova Venda - Movax",
      route: "sales"
    }
  ]
};

export function formatMZN(amount: number): string {
  return new Intl.NumberFormat('pt-MZ', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount) + ' MZN';
}
