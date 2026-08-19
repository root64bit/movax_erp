import React from 'react';
import { STITCH_CONFIG } from '../stitch/stitchConfig';

export const StitchConnection: React.FC = () => {
  const { projectId, title, theme } = STITCH_CONFIG;

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className="bg-white dark:bg-[#1f2325] border border-[#c3c6d1] dark:border-[#43474f] rounded overflow-hidden shadow-sm">
        <div className="bg-[#003366] text-white px-6 py-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg flex items-center">
              <span className="material-symbols-outlined mr-2">hub</span>
              Stitch Design System - Conexão Ativa
            </h3>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[#80f98b] text-[#001e40]">
              <span className="w-2 h-2 rounded-full bg-[#006e25] mr-2 animate-pulse"></span>
              Sincronizado
            </span>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Project Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="p-4 bg-[#f3f4f5] dark:bg-[#282c2e] rounded border border-[#c3c6d1] dark:border-[#43474f]">
              <label className="text-xs font-bold text-[#737780] uppercase block mb-1">ID do Projecto Stitch</label>
              <p className="font-mono font-bold text-[#003366] dark:text-[#a7c8ff] select-all">{projectId}</p>
            </div>
            <div className="p-4 bg-[#f3f4f5] dark:bg-[#282c2e] rounded border border-[#c3c6d1] dark:border-[#43474f]">
              <label className="text-xs font-bold text-[#737780] uppercase block mb-1">Título do Projecto</label>
              <p className="font-bold text-[#191c1d] dark:text-white">{title}</p>
            </div>
          </div>

          {/* Link to Stitch */}
          <div className="flex items-center space-x-4">
            <a
              href={`https://stitch.withgoogle.com/projects/${projectId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-5 py-2.5 bg-[#003366] text-white font-bold text-xs uppercase rounded hover:brightness-110 shadow transition-all"
            >
              <span className="material-symbols-outlined mr-2">open_in_new</span>
              Abrir no Stitch Editor
            </a>
            <a
              href={import.meta.env.VITE_REPOSITORY_URL || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-5 py-2.5 bg-[#191c1d] text-white font-bold text-xs uppercase rounded hover:brightness-110 shadow transition-all"
            >
              <span className="material-symbols-outlined mr-2">code</span>
              Repositório do Projeto
            </a>
          </div>

          {/* Color Palette Preview */}
          <div>
            <h4 className="text-xs font-bold text-[#737780] uppercase mb-3">Paleta de Cores do Design System</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {Object.entries(theme.colors).slice(0, 12).map(([name, hex]) => (
                <div key={name} className="text-center">
                  <div
                    className="w-full h-12 rounded border border-[#c3c6d1] dark:border-[#43474f] shadow-sm"
                    style={{ backgroundColor: hex }}
                  ></div>
                  <p className="text-[10px] font-bold text-[#737780] mt-1 truncate">{name}</p>
                  <p className="text-[10px] font-mono text-[#737780]">{hex}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Screens from Stitch */}
          <div>
            <h4 className="text-xs font-bold text-[#737780] uppercase mb-3">Ecrãs Conectados do Stitch</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {STITCH_CONFIG.screens.map((screen) => (
                <div
                  key={screen.id}
                  className="p-4 border border-[#c3c6d1] dark:border-[#43474f] rounded bg-[#f8f9fa] dark:bg-[#282c2e] hover:border-[#003366] transition-colors"
                >
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="material-symbols-outlined text-[#003366] dark:text-[#a7c8ff] text-lg">
                      desktop_windows
                    </span>
                    <span className="font-bold text-sm text-[#191c1d] dark:text-white">{screen.title}</span>
                  </div>
                  <p className="text-[10px] font-mono text-[#737780]">ID: {screen.id}</p>
                  <p className="text-[10px] font-mono text-[#003366] dark:text-[#a7c8ff]">Rota: /{screen.route}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Supabase Connection Info */}
          <div className="border-t border-[#c3c6d1] dark:border-[#43474f] pt-6">
            <h4 className="text-xs font-bold text-[#737780] uppercase mb-3">Supabase Backend</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-[#f3f4f5] dark:bg-[#282c2e] rounded border border-[#c3c6d1] dark:border-[#43474f]">
                <label className="text-xs font-bold text-[#737780] uppercase block mb-1">Supabase Project URL</label>
                <p className="font-mono text-xs text-[#003366] dark:text-[#a7c8ff] select-all break-all">
                  {import.meta.env.VITE_SUPABASE_URL || 'Supabase não configurado'}
                </p>
              </div>
              <div className="p-4 bg-[#80f98b]/10 rounded border border-[#006e25]/20">
                <label className="text-xs font-bold text-[#006e25] uppercase block mb-1">Estado da Conexão</label>
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-full bg-[#006e25] animate-pulse"></span>
                  <span className="font-bold text-sm text-[#006e25]">Online & Autenticado</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
