import { includes } from 'lodash'

const generateProfileLink = (id, screenName, restrictedNicknames) => {
  const complicated = !screenName || (isExternal(screenName) || includes(restrictedNicknames, screenName))
  return {
    name: (complicated ? 'user-profile-id' : 'user-profile-nick'),
    params: (complicated ? { id } : { name: screenName })
  }
}

const isExternal = screenName => screenName && screenName.includes('@')

export default generateProfileLink
