export const SOUND_SCHEMA = {
  dialogue: { required: false, description: 'Spoken dialogue, speaker and timing information.' },
  ambience: { required: false, description: 'Environmental room tone and location ambience.' },
  foley: { required: false, description: 'Synchronized physical-action sounds.' },
  sfx: { required: false, description: 'Designed sound effects and impacts.' },
  music: { required: false, description: 'Score or music cue information.' },
  mix: { required: false, description: 'Levels, spatialization and mastering metadata.' },
  sync: { required: false, description: 'Relationship between audio events and picture timestamps.' }
};

export function normalizeSoundPlan(input = {}) {
  return {
    dialogue: input.dialogue || [],
    ambience: input.ambience || [],
    foley: input.foley || [],
    sfx: input.sfx || [],
    music: input.music || [],
    mix: input.mix || {},
    sync: input.sync || []
  };
}
