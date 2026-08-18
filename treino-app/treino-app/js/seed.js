// seed.js — dados iniciais. Os exercícios de exemplo são claramente marcados
// e podem ser apagados a qualquer momento em Configurações > Limpar dados de exemplo.

import { db, uid } from './db.js';

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export async function seedIfEmpty() {
  const existingDays = await db.getAll(db.STORES.days);
  if (existingDays.length > 0) return; // já inicializado, não sobrescreve nada

  const workoutA = { id: uid('workout'), name: 'Treino A', order: 0 };
  const workoutB = { id: uid('workout'), name: 'Treino B', order: 1 };

  await db.bulkPut(db.STORES.workouts, [workoutA, workoutB]);

  const days = [
    { id: 0, name: DAY_NAMES[0], type: 'rest', workoutId: null },
    { id: 1, name: DAY_NAMES[1], type: 'workout', workoutId: workoutA.id },
    { id: 2, name: DAY_NAMES[2], type: 'workout', workoutId: workoutB.id },
    { id: 3, name: DAY_NAMES[3], type: 'rest', workoutId: null },
    { id: 4, name: DAY_NAMES[4], type: 'workout', workoutId: workoutA.id },
    { id: 5, name: DAY_NAMES[5], type: 'workout', workoutId: workoutB.id },
    { id: 6, name: DAY_NAMES[6], type: 'rest', workoutId: null }
  ];
  await db.bulkPut(db.STORES.days, days);

  const exampleExercises = [
    {
      id: uid('ex'), workoutId: workoutA.id, order: 0,
      name: 'Elevação pélvica (EXEMPLO)', nameEn: 'Hip Thrust',
      muscleGroup: 'Glúteos', equipment: 'Barra', image: '🏋️‍♀️',
      instructions: 'Apoie as costas no banco, empurre o quadril para cima contraindo os glúteos.',
      sets: 4, reps: '10-12', restSeconds: 90, notes: 'Movimento controlado.'
    },
    {
      id: uid('ex'), workoutId: workoutA.id, order: 1,
      name: 'Agachamento (EXEMPLO)', nameEn: 'Squat',
      muscleGroup: 'Pernas', equipment: 'Barra livre', image: '🏋️',
      instructions: 'Desça controlando o joelho, mantendo a coluna neutra.',
      sets: 3, reps: '8-10', restSeconds: 120, notes: ''
    },
    {
      id: uid('ex'), workoutId: workoutB.id, order: 0,
      name: 'Remada curvada (EXEMPLO)', nameEn: 'Bent-over Row',
      muscleGroup: 'Costas', equipment: 'Barra', image: '💪',
      instructions: 'Tronco levemente inclinado, puxe a barra em direção ao abdômen.',
      sets: 4, reps: '10-12', restSeconds: 90, notes: ''
    },
    {
      id: uid('ex'), workoutId: workoutB.id, order: 1,
      name: 'Desenvolvimento de ombro (EXEMPLO)', nameEn: 'Shoulder Press',
      muscleGroup: 'Ombros', equipment: 'Halteres', image: '🏋️‍♀️',
      instructions: 'Empurre os halteres para cima sem travar totalmente o cotovelo.',
      sets: 3, reps: '10-12', restSeconds: 60, notes: ''
    }
  ];
  await db.bulkPut(db.STORES.exercises, exampleExercises);

  await db.put(db.STORES.settings, {
    id: 'app',
    soundEnabled: true,
    defaultRestSeconds: 60,
    theme: 'dark',
    onboardingSeen: false
  });
}

export { DAY_NAMES };
