import React, { useState, useEffect, useRef } from 'react';
import * as fabric from 'fabric';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import {
  Square,
  Circle,
  Triangle,
  Type,
  Image as ImageIcon,
  Palette,
  Download,
  Upload,
  Save,
  Trash2,
  RotateCcw,
  RotateCw,
  Copy,
  Layers,
  Move,
  ZoomIn,
  ZoomOut,
  Grid,
  Eye,
  EyeOff
} from 'lucide-react';

interface DesignProject {
  id: string;
  name: string;
  description?: string;
  thumbnail: string;
  created_at: string;
  updated_at: string;
  canvas_data: any;
}

const DesignAccount: React.FC = () => {
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvas, setCanvas] = useState<fabric.Canvas | null>(null);
  const [projects, setProjects] = useState<DesignProject[]>([]);
  const [currentProject, setCurrentProject] = useState<DesignProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTool, setSelectedTool] = useState<'select' | 'rectangle' | 'circle' | 'triangle' | 'text' | 'image'>('select');
  const [showGrid, setShowGrid] = useState(false);
  const [showLayers, setShowLayers] = useState(false);
  const [canvasColor, setCanvasColor] = useState('#ffffff');
  const [brushColor, setBrushColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(5);

  useEffect(() => {
    if (canvasRef.current && !canvas) {
      const fabricCanvas = new fabric.Canvas(canvasRef.current, {
        width: 800,
        height: 600,
        backgroundColor: canvasColor
      });
      setCanvas(fabricCanvas);
    }

    return () => {
      if (canvas) {
        canvas.dispose();
      }
    };
  }, []);

  useEffect(() => {
    if (user) {
      fetchProjects();
    }
  }, [user]);

  useEffect(() => {
    if (canvas) {
      canvas.backgroundColor = canvasColor;
      canvas.renderAll();
    }
  }, [canvasColor, canvas]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('design_projects')
        .select('*')
        .eq('user_id', user?.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const saveProject = async () => {
    if (!canvas || !user) return;

    try {
      const canvasData = canvas.toJSON();
      const thumbnail = canvas.toDataURL({ format: 'png', quality: 0.8 });
      
      const projectData = {
        user_id: user.id,
        name: currentProject?.name || `Design ${new Date().toLocaleDateString()}`,
        canvas_data: JSON.stringify(canvasData),
        thumbnail,
        updated_at: new Date().toISOString()
      };

      if (currentProject) {
        const { error } = await supabase
          .from('design_projects')
          .update(projectData)
          .eq('id', currentProject.id);
        
        if (error) throw error;
        toast.success('Project updated successfully');
      } else {
        const { data, error } = await supabase
          .from('design_projects')
          .insert([{ ...projectData, created_at: new Date().toISOString() }])
          .select()
          .single();
        
        if (error) throw error;
        setCurrentProject(data);
        toast.success('Project saved successfully');
      }
      
      fetchProjects();
    } catch (error) {
      console.error('Error saving project:', error);
      toast.error('Failed to save project');
    }
  };

  const loadProject = async (project: DesignProject) => {
    if (!canvas) return;

    try {
      const canvasData = typeof project.canvas_data === 'string' 
        ? JSON.parse(project.canvas_data) 
        : project.canvas_data;
      
      canvas.loadFromJSON(canvasData, () => {
        canvas.renderAll();
        setCurrentProject(project);
        toast.success('Project loaded successfully');
      });
    } catch (error) {
      console.error('Error loading project:', error);
      toast.error('Failed to load project');
    }
  };

  const deleteProject = async (projectId: string) => {
    try {
      const { error } = await supabase
        .from('design_projects')
        .delete()
        .eq('id', projectId)
        .eq('user_id', user?.id);

      if (error) throw error;
      
      setProjects(projects.filter(p => p.id !== projectId));
      if (currentProject?.id === projectId) {
        setCurrentProject(null);
        canvas?.clear();
      }
      toast.success('Project deleted successfully');
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error('Failed to delete project');
    }
  };

  const addShape = (shapeType: 'rectangle' | 'circle' | 'triangle') => {
    if (!canvas) return;

    let shape: fabric.Object;
    const options = {
      left: 100,
      top: 100,
      fill: brushColor,
      stroke: '#000000',
      strokeWidth: 2
    };

    switch (shapeType) {
      case 'rectangle':
        shape = new fabric.Rect({ ...options, width: 100, height: 80 });
        break;
      case 'circle':
        shape = new fabric.Circle({ ...options, radius: 50 });
        break;
      case 'triangle':
        shape = new fabric.Triangle({ ...options, width: 100, height: 80 });
        break;
      default:
        return;
    }

    canvas.add(shape);
    canvas.setActiveObject(shape);
    canvas.renderAll();
  };

  const addText = () => {
    if (!canvas) return;

    const text = new fabric.IText('Click to edit', {
      left: 100,
      top: 100,
      fontFamily: 'Arial',
      fontSize: 20,
      fill: brushColor
    });

    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.renderAll();
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !canvas) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const imgUrl = e.target?.result as string;
      fabric.Image.fromURL(imgUrl, (img) => {
        img.scaleToWidth(200);
        img.set({ left: 100, top: 100 });
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
      });
    };
    reader.readAsDataURL(file);
  };

  const deleteSelected = () => {
    if (!canvas) return;
    const activeObjects = canvas.getActiveObjects();
    canvas.discardActiveObject();
    canvas.remove(...activeObjects);
    canvas.renderAll();
  };

  const duplicateSelected = () => {
    if (!canvas) return;
    const activeObject = canvas.getActiveObject();
    if (activeObject) {
      activeObject.clone((cloned: fabric.Object) => {
        cloned.set({
          left: (cloned.left || 0) + 10,
          top: (cloned.top || 0) + 10
        });
        canvas.add(cloned);
        canvas.setActiveObject(cloned);
        canvas.renderAll();
      });
    }
  };

  const downloadCanvas = () => {
    if (!canvas) return;
    const dataURL = canvas.toDataURL({ format: 'png', quality: 1.0 });
    const link = document.createElement('a');
    link.download = `${currentProject?.name || 'design'}.png`;
    link.href = dataURL;
    link.click();
  };

  const clearCanvas = () => {
    if (!canvas) return;
    canvas.clear();
    canvas.backgroundColor = canvasColor;
    canvas.renderAll();
  };

  const zoomIn = () => {
    if (!canvas) return;
    const zoom = canvas.getZoom();
    canvas.setZoom(Math.min(zoom * 1.1, 3));
  };

  const zoomOut = () => {
    if (!canvas) return;
    const zoom = canvas.getZoom();
    canvas.setZoom(Math.max(zoom * 0.9, 0.1));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100">
      <div className="flex h-screen">
        {/* Sidebar */}
        <div className="w-80 bg-white shadow-lg border-r border-gray-200 flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Design Studio</h1>
            <p className="text-gray-600">Create and manage your designs</p>
          </div>

          {/* Tools */}
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Tools</h3>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setSelectedTool('select')}
                className={`p-3 rounded-lg border-2 transition-all ${
                  selectedTool === 'select'
                    ? 'border-purple-500 bg-purple-50 text-purple-600'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Move className="h-5 w-5 mx-auto" />
              </button>
              <button
                onClick={() => { setSelectedTool('rectangle'); addShape('rectangle'); }}
                className={`p-3 rounded-lg border-2 transition-all ${
                  selectedTool === 'rectangle'
                    ? 'border-purple-500 bg-purple-50 text-purple-600'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Square className="h-5 w-5 mx-auto" />
              </button>
              <button
                onClick={() => { setSelectedTool('circle'); addShape('circle'); }}
                className={`p-3 rounded-lg border-2 transition-all ${
                  selectedTool === 'circle'
                    ? 'border-purple-500 bg-purple-50 text-purple-600'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Circle className="h-5 w-5 mx-auto" />
              </button>
              <button
                onClick={() => { setSelectedTool('triangle'); addShape('triangle'); }}
                className={`p-3 rounded-lg border-2 transition-all ${
                  selectedTool === 'triangle'
                    ? 'border-purple-500 bg-purple-50 text-purple-600'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Triangle className="h-5 w-5 mx-auto" />
              </button>
              <button
                onClick={() => { setSelectedTool('text'); addText(); }}
                className={`p-3 rounded-lg border-2 transition-all ${
                  selectedTool === 'text'
                    ? 'border-purple-500 bg-purple-50 text-purple-600'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Type className="h-5 w-5 mx-auto" />
              </button>
              <label className={`p-3 rounded-lg border-2 transition-all cursor-pointer ${
                selectedTool === 'image'
                  ? 'border-purple-500 bg-purple-50 text-purple-600'
                  : 'border-gray-200 hover:border-gray-300'
              }`}>
                <ImageIcon className="h-5 w-5 mx-auto" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Colors */}
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Colors</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Fill Color</label>
                <input
                  type="color"
                  value={brushColor}
                  onChange={(e) => setBrushColor(e.target.value)}
                  className="w-full h-8 rounded border border-gray-300"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Canvas Color</label>
                <input
                  type="color"
                  value={canvasColor}
                  onChange={(e) => setCanvasColor(e.target.value)}
                  className="w-full h-8 rounded border border-gray-300"
                />
              </div>
            </div>
          </div>

          {/* Projects */}
          <div className="flex-1 p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">Projects</h3>
              <button
                onClick={() => {
                  setCurrentProject(null);
                  clearCanvas();
                }}
                className="text-xs bg-purple-500 text-white px-2 py-1 rounded hover:bg-purple-600 transition-colors"
              >
                New
              </button>
            </div>
            <div className="space-y-2">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    currentProject?.id === project.id
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => loadProject(project)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-gray-900 truncate">
                        {project.name}
                      </h4>
                      <p className="text-xs text-gray-500">
                        {new Date(project.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteProject(project.id);
                      }}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Canvas Area */}
        <div className="flex-1 flex flex-col">
          {/* Toolbar */}
          <div className="bg-white border-b border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <button
                  onClick={saveProject}
                  className="flex items-center px-3 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </button>
                <button
                  onClick={downloadCanvas}
                  className="flex items-center px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </button>
                <div className="w-px h-6 bg-gray-300 mx-2"></div>
                <button
                  onClick={duplicateSelected}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                  title="Duplicate"
                >
                  <Copy className="h-4 w-4" />
                </button>
                <button
                  onClick={deleteSelected}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <div className="w-px h-6 bg-gray-300 mx-2"></div>
                <button
                  onClick={zoomIn}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                  title="Zoom In"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
                <button
                  onClick={zoomOut}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                  title="Zoom Out"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowGrid(!showGrid)}
                  className={`p-2 rounded ${
                    showGrid ? 'bg-purple-100 text-purple-600' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                  title="Toggle Grid"
                >
                  <Grid className="h-4 w-4" />
                </button>
                <button
                  onClick={clearCanvas}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                  title="Clear Canvas"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Canvas */}
          <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
            <div className="bg-white rounded-lg shadow-lg p-4">
              <canvas
                ref={canvasRef}
                className="border border-gray-300 rounded"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DesignAccount;