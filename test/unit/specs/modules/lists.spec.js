import { cloneDeep } from 'lodash'
import { defaultState, mutations, getters } from '../../../../src/modules/lists.js'

describe('The lists module', () => {
  describe('mutations', () => {
    it('updates array of all lists', () => {
      const state = cloneDeep(defaultState)
      const list = { id: '1', title: 'testList' }

      mutations.setLists(state, [list])
      expect(state.allLists).to.have.length(1)
      expect(state.allLists).to.eql([list])
    })

    it('adds a new list with a title, updating the title for existing lists', () => {
      const state = cloneDeep(defaultState)

      // new list
      const listInit = { id: '1', title: 'testList' }
      const listResultObj = { title: 'testList', accountIds: [] }
      const listResultItem = { id: '1', ...listResultObj }

      mutations.setList(state, listInit)
      expect(state.allListsObject[listInit.id]).to.eql(listResultObj)
      expect(state.allLists).to.have.length(1)
      expect(state.allLists[0]).to.eql(listResultItem)

      // update
      const modParams = { id: '1', title: 'anotherTestTitle' }
      const modResultObj = { title: 'anotherTestTitle', accountIds: [] }
      const modResultItem = { id: '1', ...modResultObj }

      mutations.setList(state, modParams)
      expect(state.allListsObject[modParams.id]).to.eql(modResultObj)
      expect(state.allLists).to.have.length(1)
      expect(state.allLists[0]).to.eql(modResultItem)
    })

    it('adds a new list with an array of IDs, updating the IDs for existing lists', () => {
      const state = cloneDeep(defaultState)

      // new list
      const list = { id: '1', accountIds: ['1', '2', '3'] }
      mutations.setListAccounts(state, list)
      expect(state.allListsObject[list.id]).to.eql({ accountIds: list.accountIds, title: "" })

      // update, preserving title
      const title = "FunList"
      mutations.setList(state, { id: list.id, title })

      const modParams = { id: list.id, accountIds: ['3', '4', '5'] }
      mutations.setListAccounts(state, modParams)
      expect(state.allListsObject[modParams.id]).to.eql({ accountIds: modParams.accountIds, title })
    })

    it('deletes a list', () => {
      const state = {
        allLists: [{ id: '1', title: 'testList' }],
        allListsObject: {
          1: { title: 'testList', accountIds: ['1', '2', '3'] }
        }
      }
      const id = '1'

      mutations.deleteList(state, { id })
      expect(state.allLists).to.have.length(0)
      expect(state.allListsObject).to.eql({})
    })
  })

  describe('getters', () => {
    it('returns list title', () => {
      const state = {
        allLists: [{ id: '1', title: 'testList' }],
        allListsObject: {
          1: { title: 'testList', accountIds: ['1', '2', '3'] }
        }
      }
      const id = '1'

      expect(getters.findListTitle(state)(id)).to.eql('testList')
    })

    it('returns list accounts', () => {
      const state = {
        allLists: [{ id: '1', title: 'testList' }],
        allListsObject: {
          1: { title: 'testList', accountIds: ['1', '2', '3'] }
        }
      }
      const id = '1'

      expect(getters.findListAccounts(state)(id)).to.eql(['1', '2', '3'])
    })
  })
})
