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
  compare: (sa, sb) => {
    if (sa === 'local') {
      if (sb === 'direct')
        return 1;
      else if (sb === sa)
        return 0;
      else
       return -1;
    }

    if (sa === sb)
      return 0;

    return SCOPE_LEVELS[sa] < SCOPE_LEVELS[sb] ? -1 : 1;
  }
}
