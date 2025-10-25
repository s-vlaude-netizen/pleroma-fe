import { library } from '@fortawesome/fontawesome-svg-core'
import {
  faEnvelope,
  faLock,
  faLockOpen,
  faGlobe
} from '@fortawesome/free-solid-svg-icons'

import scopeUtils from 'src/lib/scope_utils.js'

library.add(
  faEnvelope,
  faGlobe,
  faLock,
  faLockOpen
)

const ScopeSelector = {
  props: [
    'showAll',
    'userDefault',
    // scope of parent object
    'originalScope',
    'initialScope',
    'onScopeChange'
  ],
  data () {
    return {
      currentScope: this.initialScope
    }
  },
  computed: {
    showNothing () {
      return !this.showPublic && !this.showUnlisted && !this.showPrivate && !this.showDirect
    },
    showPublic () {
      return this.shouldShow('public')
    },
    showLocal () {
      return this.shouldShow('local')
    },
    showUnlisted () {
      return this.shouldShow('unlisted')
    },
    showPrivate () {
      return this.shouldShow('private')
    },
    showDirect () {
      return this.shouldShow('direct')
    },
    css () {
      return {
        public: { selected: this.currentScope === 'public' },
        unlisted: { selected: this.currentScope === 'unlisted' },
        private: { selected: this.currentScope === 'private' },
        direct: { selected: this.currentScope === 'direct' },
        local: { selected: this.currentScope === 'local' }
      }
    }
  },
  methods: {
    shouldShow (scope) {
      if (!this.originalScope)
        return true
      else
        return scopeUtils.isSubScope(this.originalScope, scope)
    },
    changeVis (scope) {
      this.currentScope = scope
      this.onScopeChange && this.onScopeChange(scope)
    }
  }
}

export default ScopeSelector
