import type { APIRoute } from 'astro';
import { getEnv, jsonResponse } from '../../utils/api-helpers';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  const username = getEnv('DUOLINGO_USERNAME', locals);
  const jwt = getEnv('DUOLINGO_JWT', locals);

  const configured =
    username !== '' &&
    jwt !== '' &&
    username !== 'your_duolingo_username' &&
    jwt !== 'your_jwt_token_here';

  return jsonResponse({ 
    configured,
    hints: {
      hasUsername: username !== '',
      hasJwt: jwt !== '',
      isDefaultUsername: username === 'your_duolingo_username',
      isDefaultJwt: jwt === 'your_jwt_token_here'
    }
  });
};
