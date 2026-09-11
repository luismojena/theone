import { completeMALWatching } from './src/legacy/mal.js';

completeMALWatching().catch(err => {
  console.error('An unexpected error occurred:', err);
});
