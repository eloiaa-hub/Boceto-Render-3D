import * as T from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { toCreasedNormals, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WebGLPathTracer, PhysicalCamera } from 'three-gpu-pathtracer';
// three r187 ya no trae este fragmento; el trazador lo incluye sin usarlo (pasa el cubo de entorno a equirectangular)
if (!T.ShaderChunk.cube_uv_reflection_fragment) T.ShaderChunk.cube_uv_reflection_fragment = '';
window.THREE = Object.assign({}, T, { OrbitControls, RoomEnvironment, RoundedBoxGeometry, toCreasedNormals, mergeVertices, WebGLPathTracer, PhysicalCamera });
