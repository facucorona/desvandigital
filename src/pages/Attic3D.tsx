import React, { useRef, useEffect, useState, Suspense } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Box, Sphere, Cylinder } from '@react-three/drei';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import {
  Save,
  RotateCcw,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Settings,
  Info,
  Lightbulb,
  BookOpen,
  Image,
  Cube,
  Circle,
  Square,
  Triangle
} from 'lucide-react';

interface MemoryObject {
  id: string;
  type: 'box' | 'sphere' | 'cylinder' | 'text';
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color: string;
  content?: string;
  title?: string;
  description?: string;
}

interface AtticScene {
  id?: string;
  user_id: string;
  name: string;
  description: string;
  objects: MemoryObject[];
  created_at?: string;
  updated_at?: string;
}

// 3D Object Components
const MemoryBox: React.FC<{
  object: MemoryObject;
  isSelected: boolean;
  onSelect: () => void;
}> = ({ object, isSelected, onSelect }) => {
  const meshRef = useRef<THREE.Mesh>(null!);
  
  useFrame((state) => {
    if (isSelected && meshRef.current) {
      meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 2) * 0.1;
    }
  });

  return (
    <Box
      ref={meshRef}
      position={object.position}
      rotation={object.rotation}
      scale={object.scale}
      onClick={onSelect}
    >
      <meshStandardMaterial
        color={object.color}
        transparent
        opacity={isSelected ? 0.8 : 0.9}
      />
      {object.content && (
        <Text
          position={[0, 0, 0.6]}
          fontSize={0.2}
          color="white"
          anchorX="center"
          anchorY="middle"
        >
          {object.content}
        </Text>
      )}
    </Box>
  );
};

const MemorySphere: React.FC<{
  object: MemoryObject;
  isSelected: boolean;
  onSelect: () => void;
}> = ({ object, isSelected, onSelect }) => {
  const meshRef = useRef<THREE.Mesh>(null!);
  
  useFrame((state) => {
    if (isSelected && meshRef.current) {
      meshRef.current.position.y = object.position[1] + Math.sin(state.clock.elapsedTime * 3) * 0.1;
    }
  });

  return (
    <Sphere
      ref={meshRef}
      position={object.position}
      rotation={object.rotation}
      scale={object.scale}
      onClick={onSelect}
    >
      <meshStandardMaterial
        color={object.color}
        transparent
        opacity={isSelected ? 0.8 : 0.9}
      />
      {object.content && (
        <Text
          position={[0, 0, 0.6]}
          fontSize={0.15}
          color="white"
          anchorX="center"
          anchorY="middle"
        >
          {object.content}
        </Text>
      )}
    </Sphere>
  );
};

const MemoryCylinder: React.FC<{
  object: MemoryObject;
  isSelected: boolean;
  onSelect: () => void;
}> = ({ object, isSelected, onSelect }) => {
  return (
    <Cylinder
      position={object.position}
      rotation={object.rotation}
      scale={object.scale}
      onClick={onSelect}
    >
      <meshStandardMaterial
        color={object.color}
        transparent
        opacity={isSelected ? 0.8 : 0.9}
      />
      {object.content && (
        <Text
          position={[0, 0.6, 0]}
          fontSize={0.15}
          color="white"
          anchorX="center"
          anchorY="middle"
        >
          {object.content}
        </Text>
      )}
    </Cylinder>
  );
};

const MemoryText: React.FC<{
  object: MemoryObject;
  isSelected: boolean;
  onSelect: () => void;
}> = ({ object, isSelected, onSelect }) => {
  return (
    <Text
      position={object.position}
      rotation={object.rotation}
      scale={object.scale}
      fontSize={0.3}
      color={object.color}
      anchorX="center"
      anchorY="middle"
      onClick={onSelect}
    >
      {object.content || 'Texto'}
    </Text>
  );
};

// Attic Environment
const AtticEnvironment: React.FC = () => {
  return (
    <>
      {/* Floor */}
      <Box position={[0, -0.5, 0]} scale={[20, 0.1, 20]}>
        <meshStandardMaterial color="#8B4513" />
      </Box>
      
      {/* Walls */}
      <Box position={[0, 5, -10]} scale={[20, 10, 0.2]}>
        <meshStandardMaterial color="#D2B48C" />
      </Box>
      <Box position={[-10, 5, 0]} scale={[0.2, 10, 20]}>
        <meshStandardMaterial color="#D2B48C" />
      </Box>
      <Box position={[10, 5, 0]} scale={[0.2, 10, 20]}>
        <meshStandardMaterial color="#D2B48C" />
      </Box>
      
      {/* Roof beams */}
      {[-8, -4, 0, 4, 8].map((x, i) => (
        <Box key={i} position={[x, 9, 0]} scale={[0.3, 0.3, 20]}>
          <meshStandardMaterial color="#654321" />
        </Box>
      ))}
      
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <pointLight position={[0, 8, 0]} intensity={1} />
      <pointLight position={[-5, 6, -5]} intensity={0.5} />
      <pointLight position={[5, 6, 5]} intensity={0.5} />
    </>
  );
};

// Main Scene Component
const AtticScene: React.FC<{
  objects: MemoryObject[];
  selectedObject: string | null;
  onSelectObject: (id: string | null) => void;
}> = ({ objects, selectedObject, onSelectObject }) => {
  return (
    <>
      <AtticEnvironment />
      {objects.map((object) => {
        const isSelected = selectedObject === object.id;
        const onSelect = () => onSelectObject(isSelected ? null : object.id);
        
        switch (object.type) {
          case 'box':
            return (
              <MemoryBox
                key={object.id}
                object={object}
                isSelected={isSelected}
                onSelect={onSelect}
              />
            );
          case 'sphere':
            return (
              <MemorySphere
                key={object.id}
                object={object}
                isSelected={isSelected}
                onSelect={onSelect}
              />
            );
          case 'cylinder':
            return (
              <MemoryCylinder
                key={object.id}
                object={object}
                isSelected={isSelected}
                onSelect={onSelect}
              />
            );
          case 'text':
            return (
              <MemoryText
                key={object.id}
                object={object}
                isSelected={isSelected}
                onSelect={onSelect}
              />
            );
          default:
            return null;
        }
      })}
    </>
  );
};

const Attic3D: React.FC = () => {
  const { user } = useAuth();
  const [scene, setScene] = useState<AtticScene>({
    user_id: user?.id || '',
    name: 'Mi Palacio de Memoria',
    description: 'Un espacio para organizar mis conocimientos',
    objects: []
  });
  const [selectedObject, setSelectedObject] = useState<string | null>(null);
  const [showUI, setShowUI] = useState(true);
  const [loading, setLoading] = useState(false);
  const [editingObject, setEditingObject] = useState<MemoryObject | null>(null);
  const [showObjectPanel, setShowObjectPanel] = useState(false);

  const objectTypes = [
    { type: 'box' as const, icon: <Cube className="h-5 w-5" />, label: 'Cubo' },
    { type: 'sphere' as const, icon: <Circle className="h-5 w-5" />, label: 'Esfera' },
    { type: 'cylinder' as const, icon: <Square className="h-5 w-5" />, label: 'Cilindro' },
    { type: 'text' as const, icon: <BookOpen className="h-5 w-5" />, label: 'Texto' }
  ];

  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'
  ];

  useEffect(() => {
    if (user) {
      loadScene();
    }
  }, [user]);

  const loadScene = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('attic_scenes')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setScene(data);
      }
    } catch (error) {
      console.error('Error loading scene:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveScene = async () => {
    if (!user) {
      toast.error('Debes iniciar sesión para guardar');
      return;
    }

    try {
      setLoading(true);
      const sceneData = {
        ...scene,
        user_id: user.id,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('attic_scenes')
        .upsert(sceneData);

      if (error) throw error;

      toast.success('Escena guardada exitosamente');
    } catch (error) {
      console.error('Error saving scene:', error);
      toast.error('Error al guardar la escena');
    } finally {
      setLoading(false);
    }
  };

  const addObject = (type: MemoryObject['type']) => {
    const newObject: MemoryObject = {
      id: Date.now().toString(),
      type,
      position: [Math.random() * 6 - 3, 1, Math.random() * 6 - 3],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: colors[Math.floor(Math.random() * colors.length)],
      content: type === 'text' ? 'Nuevo texto' : `Objeto ${scene.objects.length + 1}`,
      title: `Objeto ${scene.objects.length + 1}`,
      description: 'Descripción del objeto de memoria'
    };

    setScene(prev => ({
      ...prev,
      objects: [...prev.objects, newObject]
    }));
    setSelectedObject(newObject.id);
    setEditingObject(newObject);
    setShowObjectPanel(true);
  };

  const deleteObject = (objectId: string) => {
    setScene(prev => ({
      ...prev,
      objects: prev.objects.filter(obj => obj.id !== objectId)
    }));
    setSelectedObject(null);
    setEditingObject(null);
    setShowObjectPanel(false);
  };

  const updateObject = (updatedObject: MemoryObject) => {
    setScene(prev => ({
      ...prev,
      objects: prev.objects.map(obj => 
        obj.id === updatedObject.id ? updatedObject : obj
      )
    }));
    setEditingObject(updatedObject);
  };

  const resetScene = () => {
    setScene(prev => ({
      ...prev,
      objects: []
    }));
    setSelectedObject(null);
    setEditingObject(null);
    setShowObjectPanel(false);
  };

  const selectedObjectData = scene.objects.find(obj => obj.id === selectedObject);

  return (
    <div className="h-screen bg-gradient-to-br from-purple-900 to-blue-900 relative overflow-hidden">
      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0, 5, 10], fov: 60 }}
        shadows
        className="w-full h-full"
      >
        <Suspense fallback={null}>
          <AtticScene
            objects={scene.objects}
            selectedObject={selectedObject}
            onSelectObject={setSelectedObject}
          />
          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            minDistance={3}
            maxDistance={20}
            maxPolarAngle={Math.PI / 2}
          />
        </Suspense>
      </Canvas>

      {/* UI Overlay */}
      {showUI && (
        <>
          {/* Top Bar */}
          <div className="absolute top-0 left-0 right-0 bg-black/20 backdrop-blur-sm border-b border-white/10 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-white">{scene.name}</h1>
                <p className="text-white/70 text-sm">{scene.description}</p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={saveScene}
                  disabled={loading}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center space-x-2 transition-colors disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  <span>Guardar</span>
                </button>
                <button
                  onClick={resetScene}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center space-x-2 transition-colors"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Limpiar</span>
                </button>
                <button
                  onClick={() => setShowUI(false)}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg flex items-center space-x-2 transition-colors"
                >
                  <EyeOff className="h-4 w-4" />
                  <span>Ocultar UI</span>
                </button>
              </div>
            </div>
          </div>

          {/* Left Panel - Object Tools */}
          <div className="absolute left-4 top-20 bg-black/20 backdrop-blur-sm rounded-lg p-4 border border-white/10">
            <h3 className="text-white font-semibold mb-3 flex items-center">
              <Plus className="h-4 w-4 mr-2" />
              Agregar Objetos
            </h3>
            <div className="space-y-2">
              {objectTypes.map(({ type, icon, label }) => (
                <button
                  key={type}
                  onClick={() => addObject(type)}
                  className="w-full px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg flex items-center space-x-2 transition-colors"
                >
                  {icon}
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {selectedObjectData && (
              <div className="mt-6 pt-4 border-t border-white/20">
                <h4 className="text-white font-semibold mb-2">Objeto Seleccionado</h4>
                <p className="text-white/70 text-sm mb-2">{selectedObjectData.title}</p>
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      setEditingObject(selectedObjectData);
                      setShowObjectPanel(true);
                    }}
                    className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center space-x-2 transition-colors"
                  >
                    <Settings className="h-4 w-4" />
                    <span>Editar</span>
                  </button>
                  <button
                    onClick={() => deleteObject(selectedObjectData.id)}
                    className="w-full px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center space-x-2 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Eliminar</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel - Instructions */}
          <div className="absolute right-4 top-20 bg-black/20 backdrop-blur-sm rounded-lg p-4 border border-white/10 max-w-xs">
            <h3 className="text-white font-semibold mb-3 flex items-center">
              <Lightbulb className="h-4 w-4 mr-2" />
              Cómo usar
            </h3>
            <div className="space-y-2 text-white/70 text-sm">
              <p>• Haz clic en los objetos para seleccionarlos</p>
              <p>• Usa el mouse para rotar la cámara</p>
              <p>• Rueda del mouse para acercar/alejar</p>
              <p>• Arrastra con clic derecho para mover la vista</p>
              <p>• Agrega objetos para crear tu palacio de memoria</p>
            </div>
          </div>
        </>
      )}

      {/* Show UI Button (when hidden) */}
      {!showUI && (
        <button
          onClick={() => setShowUI(true)}
          className="absolute top-4 right-4 p-3 bg-black/20 backdrop-blur-sm text-white rounded-lg hover:bg-black/30 transition-colors"
        >
          <Eye className="h-5 w-5" />
        </button>
      )}

      {/* Object Edit Panel */}
      {showObjectPanel && editingObject && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Editar Objeto</h3>
              <button
                onClick={() => setShowObjectPanel(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Título
                </label>
                <input
                  type="text"
                  value={editingObject.title || ''}
                  onChange={(e) => updateObject({ ...editingObject, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contenido
                </label>
                <input
                  type="text"
                  value={editingObject.content || ''}
                  onChange={(e) => updateObject({ ...editingObject, content: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción
                </label>
                <textarea
                  value={editingObject.description || ''}
                  onChange={(e) => updateObject({ ...editingObject, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {colors.map((color) => (
                    <button
                      key={color}
                      onClick={() => updateObject({ ...editingObject, color })}
                      className={`w-8 h-8 rounded-full border-2 ${
                        editingObject.color === color ? 'border-gray-800' : 'border-gray-300'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => setShowObjectPanel(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cerrar
                </button>
                <button
                  onClick={() => {
                    setShowObjectPanel(false);
                    toast.success('Objeto actualizado');
                  }}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
            <span>Guardando...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Attic3D;