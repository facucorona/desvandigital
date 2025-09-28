import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { Home, Plus, Save, Settings, Eye, EyeOff, RotateCcw, Maximize, Info, BookOpen, Image, FileText } from 'lucide-react';
import { supabase } from '../supabase/config';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

interface AtticObject {
  id: string;
  name: string;
  type: 'furniture' | 'decoration' | 'memory_item';
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  color: string;
  memory_content?: string;
  memory_type?: 'text' | 'image' | 'link';
  created_at: string;
}

interface AtticScene {
  id: string;
  name: string;
  description: string;
  user_id: string;
  scene_data: any;
  is_public: boolean;
  created_at: string;
}

const AtticEnvironment: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<any>(null);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const selectedObjectRef = useRef<THREE.Object3D | null>(null);
  const animationIdRef = useRef<number | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [objects, setObjects] = useState<AtticObject[]>([]);
  const [scenes, setScenes] = useState<AtticScene[]>([]);
  const [currentScene, setCurrentScene] = useState<AtticScene | null>(null);
  const [selectedObject, setSelectedObject] = useState<AtticObject | null>(null);
  const [showObjectPanel, setShowObjectPanel] = useState(false);
  const [showScenePanel, setShowScenePanel] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [viewMode, setViewMode] = useState<'first-person' | 'third-person'>('third-person');
  const [showMemoryPanel, setShowMemoryPanel] = useState(false);
  const [memoryContent, setMemoryContent] = useState('');
  const [memoryType, setMemoryType] = useState<'text' | 'image' | 'link'>('text');
  const [sceneName, setSceneName] = useState('');
  const [sceneDescription, setSceneDescription] = useState('');

  const { user } = useAuth();

  // Initialize Three.js scene
  useEffect(() => {
    if (!mountRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Sky blue
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 5, 10);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // Create attic room
    createAtticRoom(scene);

    // Mouse controls
    const handleMouseMove = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const handleClick = (event: MouseEvent) => {
      if (!editMode) return;

      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      const intersects = raycasterRef.current.intersectObjects(scene.children, true);

      if (intersects.length > 0) {
        const object = intersects[0].object;
        if (object.userData.isMemoryObject) {
          setSelectedObject(object.userData.objectData);
          setShowMemoryPanel(true);
          selectedObjectRef.current = object;
        }
      }
    };

    renderer.domElement.addEventListener('mousemove', handleMouseMove);
    renderer.domElement.addEventListener('click', handleClick);

    // Animation loop
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);
      
      // Simple camera rotation for demo
      if (viewMode === 'third-person' && !editMode) {
        camera.position.x = Math.cos(Date.now() * 0.0005) * 15;
        camera.position.z = Math.sin(Date.now() * 0.0005) * 15;
        camera.lookAt(0, 0, 0);
      }

      renderer.render(scene, camera);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (!mountRef.current || !camera || !renderer) return;
      
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };

    window.addEventListener('resize', handleResize);

    setIsLoading(false);

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('mousemove', handleMouseMove);
      renderer.domElement.removeEventListener('click', handleClick);
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [editMode, viewMode]);

  const createAtticRoom = (scene: THREE.Scene) => {
    // Floor
    const floorGeometry = new THREE.PlaneGeometry(20, 20);
    const floorMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 }); // Brown wood
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Walls
    const wallMaterial = new THREE.MeshLambertMaterial({ color: 0xF5DEB3 }); // Beige
    
    // Back wall
    const backWallGeometry = new THREE.PlaneGeometry(20, 10);
    const backWall = new THREE.Mesh(backWallGeometry, wallMaterial);
    backWall.position.set(0, 5, -10);
    scene.add(backWall);

    // Left wall
    const leftWallGeometry = new THREE.PlaneGeometry(20, 10);
    const leftWall = new THREE.Mesh(leftWallGeometry, wallMaterial);
    leftWall.position.set(-10, 5, 0);
    leftWall.rotation.y = Math.PI / 2;
    scene.add(leftWall);

    // Right wall
    const rightWall = new THREE.Mesh(leftWallGeometry, wallMaterial);
    rightWall.position.set(10, 5, 0);
    rightWall.rotation.y = -Math.PI / 2;
    scene.add(rightWall);

    // Slanted roof
    const roofGeometry = new THREE.PlaneGeometry(20, 15);
    const roofMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    const leftRoof = new THREE.Mesh(roofGeometry, roofMaterial);
    leftRoof.position.set(-5, 8, 0);
    leftRoof.rotation.z = Math.PI / 6;
    scene.add(leftRoof);

    const rightRoof = new THREE.Mesh(roofGeometry, roofMaterial);
    rightRoof.position.set(5, 8, 0);
    rightRoof.rotation.z = -Math.PI / 6;
    scene.add(rightRoof);

    // Add some default furniture
    addDefaultFurniture(scene);
  };

  const addDefaultFurniture = (scene: THREE.Scene) => {
    // Old chest
    const chestGeometry = new THREE.BoxGeometry(2, 1, 1);
    const chestMaterial = new THREE.MeshLambertMaterial({ color: 0x654321 });
    const chest = new THREE.Mesh(chestGeometry, chestMaterial);
    chest.position.set(-5, 0.5, -5);
    chest.castShadow = true;
    chest.userData = { isMemoryObject: true, objectData: { id: 'chest-1', name: 'Old Chest', type: 'furniture' } };
    scene.add(chest);

    // Rocking chair
    const chairGeometry = new THREE.BoxGeometry(1, 2, 1);
    const chairMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    const chair = new THREE.Mesh(chairGeometry, chairMaterial);
    chair.position.set(3, 1, 2);
    chair.castShadow = true;
    chair.userData = { isMemoryObject: true, objectData: { id: 'chair-1', name: 'Rocking Chair', type: 'furniture' } };
    scene.add(chair);

    // Bookshelf
    const shelfGeometry = new THREE.BoxGeometry(0.5, 4, 2);
    const shelfMaterial = new THREE.MeshLambertMaterial({ color: 0x654321 });
    const shelf = new THREE.Mesh(shelfGeometry, shelfMaterial);
    shelf.position.set(8, 2, -3);
    shelf.castShadow = true;
    shelf.userData = { isMemoryObject: true, objectData: { id: 'shelf-1', name: 'Bookshelf', type: 'furniture' } };
    scene.add(shelf);

    // Memory orbs (floating spheres for memories)
    for (let i = 0; i < 5; i++) {
      const orbGeometry = new THREE.SphereGeometry(0.3, 16, 16);
      const orbMaterial = new THREE.MeshLambertMaterial({ 
        color: new THREE.Color().setHSL(Math.random(), 0.7, 0.6),
        transparent: true,
        opacity: 0.8
      });
      const orb = new THREE.Mesh(orbGeometry, orbMaterial);
      orb.position.set(
        (Math.random() - 0.5) * 15,
        2 + Math.random() * 3,
        (Math.random() - 0.5) * 15
      );
      orb.userData = { 
        isMemoryObject: true, 
        objectData: { 
          id: `orb-${i}`, 
          name: `Memory Orb ${i + 1}`, 
          type: 'memory_item',
          memory_content: `This is a sample memory ${i + 1}. Click to edit and add your own memories!`,
          memory_type: 'text'
        } 
      };
      scene.add(orb);

      // Add floating animation
      const animate = () => {
        orb.position.y += Math.sin(Date.now() * 0.001 + i) * 0.01;
        orb.rotation.y += 0.01;
      };
      orb.userData.animate = animate;
    }
  };

  const addMemoryObject = useCallback((type: 'furniture' | 'decoration' | 'memory_item') => {
    if (!sceneRef.current) return;

    let geometry: THREE.BufferGeometry;
    let material: THREE.Material;
    let name: string;

    switch (type) {
      case 'furniture':
        geometry = new THREE.BoxGeometry(1, 1, 1);
        material = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        name = 'Furniture';
        break;
      case 'decoration':
        geometry = new THREE.ConeGeometry(0.5, 1, 8);
        material = new THREE.MeshLambertMaterial({ color: 0xFF6B6B });
        name = 'Decoration';
        break;
      case 'memory_item':
        geometry = new THREE.SphereGeometry(0.4, 16, 16);
        material = new THREE.MeshLambertMaterial({ 
          color: new THREE.Color().setHSL(Math.random(), 0.7, 0.6),
          transparent: true,
          opacity: 0.8
        });
        name = 'Memory Item';
        break;
    }

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(
      (Math.random() - 0.5) * 10,
      type === 'memory_item' ? 2 + Math.random() * 2 : 0.5,
      (Math.random() - 0.5) * 10
    );
    mesh.castShadow = true;
    mesh.userData = {
      isMemoryObject: true,
      objectData: {
        id: `${type}-${Date.now()}`,
        name,
        type,
        position: mesh.position,
        rotation: mesh.rotation,
        scale: mesh.scale,
        color: '#' + material.color?.getHexString(),
        memory_content: type === 'memory_item' ? 'Click to add your memory here!' : undefined,
        memory_type: 'text'
      }
    };

    sceneRef.current.add(mesh);
    toast.success(`${name} added to your attic!`);
  }, []);

  const saveScene = async () => {
    if (!user || !sceneRef.current) {
      toast.error('Please sign in to save scenes');
      return;
    }

    if (!sceneName.trim()) {
      toast.error('Please enter a scene name');
      return;
    }

    try {
      const sceneData = {
        objects: sceneRef.current.children
          .filter(child => child.userData.isMemoryObject)
          .map(child => ({
            ...child.userData.objectData,
            position: child.position,
            rotation: child.rotation,
            scale: child.scale
          }))
      };

      const { error } = await supabase
        .from('attic_scenes')
        .insert({
          name: sceneName,
          description: sceneDescription,
          user_id: user.id,
          scene_data: sceneData,
          is_public: false
        });

      if (error) throw error;

      toast.success('Scene saved successfully!');
      setSceneName('');
      setSceneDescription('');
      setShowScenePanel(false);
      fetchScenes();
    } catch (error) {
      console.error('Error saving scene:', error);
      toast.error('Failed to save scene');
    }
  };

  const loadScene = async (scene: AtticScene) => {
    if (!sceneRef.current) return;

    try {
      // Clear existing objects
      const objectsToRemove = sceneRef.current.children.filter(child => child.userData.isMemoryObject);
      objectsToRemove.forEach(obj => sceneRef.current?.remove(obj));

      // Load scene objects
      if (scene.scene_data?.objects) {
        scene.scene_data.objects.forEach((objData: any) => {
          let geometry: THREE.BufferGeometry;
          let material: THREE.Material;

          switch (objData.type) {
            case 'furniture':
              geometry = new THREE.BoxGeometry(1, 1, 1);
              material = new THREE.MeshLambertMaterial({ color: objData.color || 0x8B4513 });
              break;
            case 'decoration':
              geometry = new THREE.ConeGeometry(0.5, 1, 8);
              material = new THREE.MeshLambertMaterial({ color: objData.color || 0xFF6B6B });
              break;
            case 'memory_item':
              geometry = new THREE.SphereGeometry(0.4, 16, 16);
              material = new THREE.MeshLambertMaterial({ 
                color: objData.color || new THREE.Color().setHSL(Math.random(), 0.7, 0.6),
                transparent: true,
                opacity: 0.8
              });
              break;
            default:
              return;
          }

          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.copy(objData.position);
          mesh.rotation.copy(objData.rotation);
          mesh.scale.copy(objData.scale);
          mesh.castShadow = true;
          mesh.userData = {
            isMemoryObject: true,
            objectData: objData
          };

          sceneRef.current?.add(mesh);
        });
      }

      setCurrentScene(scene);
      toast.success(`Loaded scene: ${scene.name}`);
    } catch (error) {
      console.error('Error loading scene:', error);
      toast.error('Failed to load scene');
    }
  };

  const fetchScenes = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('attic_scenes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setScenes(data || []);
    } catch (error) {
      console.error('Error fetching scenes:', error);
    }
  };

  const saveMemory = async () => {
    if (!selectedObject || !memoryContent.trim()) {
      toast.error('Please enter memory content');
      return;
    }

    try {
      // Update the object's memory content
      if (selectedObjectRef.current) {
        selectedObjectRef.current.userData.objectData.memory_content = memoryContent;
        selectedObjectRef.current.userData.objectData.memory_type = memoryType;
      }

      toast.success('Memory saved to object!');
      setShowMemoryPanel(false);
      setMemoryContent('');
      setSelectedObject(null);
    } catch (error) {
      console.error('Error saving memory:', error);
      toast.error('Failed to save memory');
    }
  };

  useEffect(() => {
    if (user) {
      fetchScenes();
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading your attic...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-900 relative overflow-hidden">
      {/* 3D Canvas */}
      <div ref={mountRef} className="w-full h-full" />

      {/* UI Overlay */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Top Bar */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center pointer-events-auto">
          <div className="flex items-center gap-4">
            <div className="bg-white/90 backdrop-blur-sm rounded-lg px-4 py-2 shadow-lg">
              <h1 className="text-xl font-bold text-gray-900">Memory Palace Attic</h1>
              {currentScene && (
                <p className="text-sm text-gray-600">{currentScene.name}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode(viewMode === 'first-person' ? 'third-person' : 'first-person')}
              className="bg-white/90 backdrop-blur-sm p-2 rounded-lg shadow-lg hover:bg-white transition-colors"
              title={`Switch to ${viewMode === 'first-person' ? 'third-person' : 'first-person'} view`}
            >
              {viewMode === 'first-person' ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
            </button>
            
            <button
              onClick={() => setEditMode(!editMode)}
              className={`p-2 rounded-lg shadow-lg transition-colors ${
                editMode 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-white/90 backdrop-blur-sm hover:bg-white'
              }`}
              title="Toggle edit mode"
            >
              <Settings className="h-5 w-5" />
            </button>

            <button
              onClick={() => setShowScenePanel(true)}
              className="bg-white/90 backdrop-blur-sm p-2 rounded-lg shadow-lg hover:bg-white transition-colors"
              title="Scene management"
            >
              <Save className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Left Panel - Object Tools */}
        {editMode && (
          <div className="absolute left-4 top-20 bg-white/90 backdrop-blur-sm rounded-lg p-4 shadow-lg pointer-events-auto">
            <h3 className="font-semibold text-gray-900 mb-3">Add Objects</h3>
            <div className="space-y-2">
              <button
                onClick={() => addMemoryObject('memory_item')}
                className="w-full flex items-center gap-2 px-3 py-2 bg-purple-100 hover:bg-purple-200 rounded-lg transition-colors"
              >
                <div className="w-4 h-4 bg-purple-500 rounded-full"></div>
                Memory Orb
              </button>
              <button
                onClick={() => addMemoryObject('furniture')}
                className="w-full flex items-center gap-2 px-3 py-2 bg-brown-100 hover:bg-brown-200 rounded-lg transition-colors"
              >
                <div className="w-4 h-4 bg-amber-700 rounded"></div>
                Furniture
              </button>
              <button
                onClick={() => addMemoryObject('decoration')}
                className="w-full flex items-center gap-2 px-3 py-2 bg-red-100 hover:bg-red-200 rounded-lg transition-colors"
              >
                <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                Decoration
              </button>
            </div>
          </div>
        )}

        {/* Instructions */}
        {editMode && (
          <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-4 shadow-lg pointer-events-auto max-w-sm">
            <div className="flex items-center gap-2 mb-2">
              <Info className="h-5 w-5 text-blue-500" />
              <h3 className="font-semibold text-gray-900">Instructions</h3>
            </div>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Click objects to add memories</li>
              <li>• Use the tools to add new objects</li>
              <li>• Save your scene when finished</li>
              <li>• Switch views for different perspectives</li>
            </ul>
          </div>
        )}
      </div>

      {/* Memory Panel */}
      {showMemoryPanel && selectedObject && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center pointer-events-auto">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-900">
                {selectedObject.name}
              </h3>
              <button
                onClick={() => setShowMemoryPanel(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Memory Type
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setMemoryType('text')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                      memoryType === 'text'
                        ? 'bg-purple-100 text-purple-700 border-purple-300'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <FileText className="h-4 w-4" />
                    Text
                  </button>
                  <button
                    onClick={() => setMemoryType('image')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                      memoryType === 'image'
                        ? 'bg-purple-100 text-purple-700 border-purple-300'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <Image className="h-4 w-4" />
                    Image
                  </button>
                  <button
                    onClick={() => setMemoryType('link')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                      memoryType === 'link'
                        ? 'bg-purple-100 text-purple-700 border-purple-300'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <BookOpen className="h-4 w-4" />
                    Link
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Memory Content
                </label>
                <textarea
                  value={memoryContent}
                  onChange={(e) => setMemoryContent(e.target.value)}
                  placeholder={`Enter your ${memoryType} memory here...`}
                  className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={saveMemory}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Save Memory
                </button>
                <button
                  onClick={() => setShowMemoryPanel(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scene Management Panel */}
      {showScenePanel && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center pointer-events-auto">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-900">Scene Management</h3>
              <button
                onClick={() => setShowScenePanel(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            {/* Save Current Scene */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-3">Save Current Scene</h4>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Scene name"
                  value={sceneName}
                  onChange={(e) => setSceneName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <textarea
                  placeholder="Scene description (optional)"
                  value={sceneDescription}
                  onChange={(e) => setSceneDescription(e.target.value)}
                  className="w-full h-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
                <button
                  onClick={saveScene}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Save Scene
                </button>
              </div>
            </div>

            {/* Load Saved Scenes */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Saved Scenes</h4>
              {scenes.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No saved scenes yet</p>
              ) : (
                <div className="space-y-2">
                  {scenes.map((scene) => (
                    <div
                      key={scene.id}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex-1">
                        <h5 className="font-medium text-gray-900">{scene.name}</h5>
                        {scene.description && (
                          <p className="text-sm text-gray-600">{scene.description}</p>
                        )}
                        <p className="text-xs text-gray-400">
                          {new Date(scene.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={() => loadScene(scene)}
                        className="ml-3 px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition-colors"
                      >
                        Load
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AtticEnvironment;