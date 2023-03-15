import { Persona } from './types';

export function buildMessage(persona: Persona): string {
  if (!persona.qualifiers || persona.qualifiers.length === 0) {
    return persona.prompt;
  }

  return `${persona.prompt.trim()}
  
  You will:
  - ${persona.qualifiers.join('\n- ')}`;
}
