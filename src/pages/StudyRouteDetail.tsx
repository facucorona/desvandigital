import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, CheckCircle, Lock, Clock, Users, Star } from 'lucide-react';
import { toast } from 'sonner';
import LoadingSpinner from '../components/LoadingSpinner';

interface StudyRoute {
  id: string;
  title: string;
  description: string;
  instructor: string;
  duration: string;
  level: string;
  price: number;
  rating: number;
  students: number;
  image_url: string;
  lessons: Lesson[];
  isEnrolled: boolean;
}

interface Lesson {
  id: string;
  title: string;
  duration: string;
  isCompleted: boolean;
  isLocked: boolean;
  type: 'video' | 'text' | 'quiz';
}

const StudyRouteDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [route, setRoute] = useState<StudyRoute | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeLesson, setActiveLesson] = useState<string | null>(null);

  useEffect(() => {
    const fetchRoute = async () => {
      try {
        // Mock data for now
        const mockRoute: StudyRoute = {
          id: id || '1',
          title: 'Diseño Digital Avanzado',
          description: 'Aprende las técnicas más avanzadas de diseño digital con herramientas profesionales. Este curso te llevará desde conceptos básicos hasta proyectos complejos.',
          instructor: 'María González',
          duration: '8 semanas',
          level: 'Intermedio',
          price: 199.99,
          rating: 4.8,
          students: 1247,
          image_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=advanced%20digital%20design%20course%20banner%20with%20modern%20graphics%20tools&image_size=landscape_16_9',
          isEnrolled: false,
          lessons: [
            {
              id: '1',
              title: 'Introducción al diseño digital',
              duration: '15 min',
              isCompleted: false,
              isLocked: false,
              type: 'video'
            },
            {
              id: '2',
              title: 'Herramientas básicas',
              duration: '25 min',
              isCompleted: false,
              isLocked: true,
              type: 'video'
            },
            {
              id: '3',
              title: 'Principios de composición',
              duration: '30 min',
              isCompleted: false,
              isLocked: true,
              type: 'text'
            },
            {
              id: '4',
              title: 'Quiz: Conceptos básicos',
              duration: '10 min',
              isCompleted: false,
              isLocked: true,
              type: 'quiz'
            }
          ]
        };
        
        setTimeout(() => {
          setRoute(mockRoute);
          setIsLoading(false);
        }, 1000);
      } catch (error) {
        toast.error('Error al cargar la ruta de estudio');
        setIsLoading(false);
      }
    };

    fetchRoute();
  }, [id]);

  const handleEnroll = async () => {
    try {
      // Simulate enrollment
      toast.success('¡Te has inscrito exitosamente!');
      if (route) {
        setRoute({ ...route, isEnrolled: true });
      }
    } catch (error) {
      toast.error('Error al inscribirse');
    }
  };

  const handleLessonClick = (lesson: Lesson) => {
    if (lesson.isLocked && !route?.isEnrolled) {
      toast.error('Debes inscribirte para acceder a esta lección');
      return;
    }
    
    if (lesson.isLocked) {
      toast.error('Completa las lecciones anteriores para desbloquear esta');
      return;
    }

    setActiveLesson(lesson.id);
    toast.success(`Reproduciendo: ${lesson.title}`);
  };

  const getLessonIcon = (lesson: Lesson) => {
    if (lesson.isCompleted) {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    }
    if (lesson.isLocked) {
      return <Lock className="h-5 w-5 text-gray-400" />;
    }
    return <Play className="h-5 w-5 text-indigo-600" />;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!route) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Ruta de estudio no encontrada</h2>
          <button
            onClick={() => navigate('/study-routes')}
            className="text-indigo-600 hover:text-indigo-500"
          >
            Volver a rutas de estudio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center text-indigo-600 hover:text-indigo-500 mb-6"
      >
        <ArrowLeft className="h-5 w-5 mr-2" />
        Volver
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Course Content */}
        <div className="lg:col-span-2">
          {/* Course Header */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-6">
            <img
              src={route.image_url}
              alt={route.title}
              className="w-full h-64 object-cover"
            />
            <div className="p-6">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">{route.title}</h1>
              <p className="text-gray-600 mb-4">{route.description}</p>
              
              <div className="flex items-center space-x-6 text-sm text-gray-600">
                <div className="flex items-center">
                  <Clock className="h-4 w-4 mr-1" />
                  {route.duration}
                </div>
                <div className="flex items-center">
                  <Users className="h-4 w-4 mr-1" />
                  {route.students} estudiantes
                </div>
                <div className="flex items-center">
                  <Star className="h-4 w-4 mr-1 text-yellow-400" />
                  {route.rating}
                </div>
              </div>
            </div>
          </div>

          {/* Lessons List */}
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Contenido del curso</h2>
            </div>
            <div className="divide-y divide-gray-200">
              {route.lessons.map((lesson, index) => (
                <div
                  key={lesson.id}
                  className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                    activeLesson === lesson.id ? 'bg-indigo-50 border-l-4 border-indigo-500' : ''
                  }`}
                  onClick={() => handleLessonClick(lesson)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getLessonIcon(lesson)}
                      <div>
                        <h3 className={`font-medium ${
                          lesson.isLocked && !route.isEnrolled ? 'text-gray-400' : 'text-gray-900'
                        }`}>
                          {index + 1}. {lesson.title}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {lesson.type === 'video' ? '📹' : lesson.type === 'quiz' ? '📝' : '📖'} {lesson.duration}
                        </p>
                      </div>
                    </div>
                    {lesson.isCompleted && (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                        Completado
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm p-6 sticky top-8">
            <div className="text-center mb-6">
              <div className="text-3xl font-bold text-indigo-600 mb-2">
                ${route.price}
              </div>
              <p className="text-gray-600">Acceso completo de por vida</p>
            </div>

            {!route.isEnrolled ? (
              <button
                onClick={handleEnroll}
                className="w-full bg-indigo-600 text-white py-3 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 font-medium mb-4"
              >
                Inscribirse ahora
              </button>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-4">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <span className="text-green-800 font-medium">¡Ya estás inscrito!</span>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Instructor:</span>
                <span className="font-medium">{route.instructor}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Nivel:</span>
                <span className="font-medium">{route.level}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Duración:</span>
                <span className="font-medium">{route.duration}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Lecciones:</span>
                <span className="font-medium">{route.lessons.length}</span>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="font-medium text-gray-900 mb-3">Lo que aprenderás:</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  Técnicas avanzadas de diseño
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  Uso profesional de herramientas
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  Proyectos prácticos reales
                </li>
                <li className="flex items-start">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  Certificado de finalización
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudyRouteDetail;