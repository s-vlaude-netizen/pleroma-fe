const SCOPE_LEVELS = {
  'direct': 0,
  'private': 1,
  'unlisted': 2,
  'local': 3,
  'public': 3
}

export default {
  negotiate: (defaultScope, maxScope) => {
    if (!maxScope)
      return defaultScope;

    if (maxScope === 'local')
      return defaultScope === 'direct' ? defaultScope : 'local';

    if (SCOPE_LEVELS[defaultScope] <= SCOPE_LEVELS[maxScope])
      return defaultScope;
    else
      return maxScope;
  },
  isSubScope: (original, subscope) => {
    if (original === 'local')
      return (subscope === 'direct' || subscope === original);

    return SCOPE_LEVELS[subscope] <= SCOPE_LEVELS[original];
  }
}
