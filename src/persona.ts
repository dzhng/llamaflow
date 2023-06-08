import { Persona } from './types';

function getPersonaPrompt(persona: Persona): string {
  if (typeof persona.prompt === 'function') {
    return persona.prompt();
  } else {
    return persona.prompt;
  }
}

export function buildMessage(persona: Persona): string {
  if (!persona.qualifiers || persona.qualifiers.length === 0) {
    return getPersonaPrompt(persona);
  }

  return `${getPersonaPrompt(
    persona,
  ).trim()}\n\nYou will:\n- ${persona.qualifiers.join('\n- ')}`;
}
