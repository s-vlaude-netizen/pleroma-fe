import SearchForm from '../search_form/search_form.vue'
import Modal from '../modal/modal.vue'
import get from 'lodash/get'

const SearchFormModal = {
  components: {
    SearchForm,
    Modal
  },
  data () {
    return { }
  },
  computed: {
    isVisible () {
      return this.$store.state.interface.searchModalOpen
    }
  },
  methods: {
    closeModal () {
      this.$store.dispatch('closeSearchModal')
      this.$refs.searchForm.resetSearchState()
    }
  }
}

export default SearchFormModal
