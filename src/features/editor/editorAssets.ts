import { createContext, useContext } from 'react';
import type { ProjectAssets } from '@/features/assets/useProjectAssets';

const EditorAssetsContext = createContext<ProjectAssets | null>(null);
export const EditorAssetsProvider = EditorAssetsContext.Provider;

export function useEditorAssets(): ProjectAssets {
  const value = useContext(EditorAssetsContext);
  if (!value) throw new Error('useEditorAssets outside EditorAssetsProvider');
  return value;
}
