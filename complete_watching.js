import { completeMALWatching } from './src/mal.js';

completeMALWatching().catch(err => {
  console.error('An unexpected error occurred:', err);
});
