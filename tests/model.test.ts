import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface ModelNode { name?: string; mesh?: number; children?: number[]; extras?: { floor_number?: number; interactive?: boolean } }
const binary = readFileSync('public/models/eco-egana.glb');
const jsonLength = binary.readUInt32LE(12);
const gltf = JSON.parse(binary.subarray(20, 20 + jsonLength).toString('utf8'));
const nodes: ModelNode[] = gltf.nodes;

function hasMesh(node: ModelNode): boolean {
  return typeof node.mesh === 'number' || (node.children?.some(child => hasMesh(nodes[child])) ?? false);
}

describe('Modelo exportado desde Blender', () => {
  it('es un archivo glTF 2 binario completo y ligero', () => {
    expect(binary.toString('utf8', 0, 4)).toBe('glTF');
    expect(binary.readUInt32LE(4)).toBe(2);
    expect(binary.readUInt32LE(8)).toBe(binary.length);
    expect(binary.length).toBeLessThan(5 * 1024 * 1024);
    expect(gltf.asset.generator.toLowerCase()).toContain('blender');
  });

  it('incluye geometría real para los 24 pisos que usa el selector', () => {
    for (let floor = 3; floor <= 26; floor++) {
      const name = `Floor_${String(floor).padStart(2, '0')}`;
      const node = nodes.find(item => item.name === name);
      expect(node, name).toBeDefined();
      expect(hasMesh(node!), name).toBe(true);
      expect(node?.extras?.floor_number, name).toBe(floor);
    }
  });

  it('incluye las texturas dentro del GLB y no depende de rutas locales de Blender', () => {
    expect(gltf.images.length).toBeGreaterThanOrEqual(2);
    for (const image of gltf.images) {
      expect(image.uri).toBeUndefined();
      expect(image.bufferView).toBeTypeOf('number');
    }
    for (const buffer of gltf.buffers) expect(buffer.uri).toBeUndefined();
    expect(nodes.some(node => node.name === 'Fundamenta_Tower_Emblem')).toBe(true);
  });
});
