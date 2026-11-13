# Guía de Recursos de Personajes (`/public/assets/characters/`)

En esta carpeta (`/public/assets/characters/`) puedes colocar tus propias imágenes (texturas, sprites con transparencia) o modelos 3D para personalizar los personajes de **Aegis Arcana**.

## 1. ¿Dónde añadir los archivos?
Coloca tus archivos directamente en:
- `/public/assets/characters/`

En Vite + React + Three.js, cualquier archivo dentro de `/public` se sirve automáticamente desde la raíz `/assets/characters/<nombre-archivo>`.

## 2. ¿En qué formato deben crearse?

### A) Si quieres usar **Imágenes 2D / Sprites / Texturas de piel y pelaje**:
- **Formato recomendado**: **`.PNG`** (con fondo transparente / canal alfa RGBA de 32 bits) o **`.WEBP`** sin pérdida.
- **Resolución ideal (Potencias de 2 para WebGL)**: `512x512 px` o `1024x1024 px`.
- **Espacio de color**: `sRGB`.
- **Nombres de archivo por personaje** (para referenciarlos en `src/three/proceduralModels.ts`):
  - `mite.png` — Cíclope Verde (estilo Mike Wazowski)
  - `gorgon.png` — Camaleón Escamoso (estilo Randall Boggs)
  - `basalt.png` — Coloso Peludo Moteado (estilo Sulley)
  - `weaver.png` — Asustador Multi-Ojos
  - `construct.png` — Operario CDA con tanque de gritos
  - `guardian.png` — Gólem / Guardián Peludo Aliado
  - `boss_titan.png` — Jefe Waternoose
  - `boss_archon.png` — Jefe Emperador del Grito Nocturno

### B) Si quieres importar **Modelos 3D completos**:
- **Formato recomendado**: **`.GLB`** (glTF 2.0 binario autoincluido con malla, texturas PBR y animaciones esqueléticas en un solo archivo).
- **Escala sugerida**: `1 unidad = 1 metro` (altura aproximada de `1.4` a `2.2` unidades) mirando hacia el eje `+Z`.
