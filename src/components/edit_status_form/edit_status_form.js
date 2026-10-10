import PostStatusForm from 'src/components/post_status_form/post_status_form.vue'
import statusPosterService from '../../services/status_poster/status_poster.service.js'

const EditStatusForm = {
  components: {
    PostStatusForm,
  },
  props: {
    params: {
      type: Object,
      required: true,
    },
  },
  methods: {
    requestClose() {
      this.$refs.postStatusForm.requestClose()
    },
    saveDraft() {
      this.$refs.postStatusForm.saveDraft()
    },
    doEditStatus({ status, spoilerText, sensitive, media, contentType, poll }) {
      const params = {
        statusId: this.params.statusId,
        status,
        spoilerText,
        sensitive,
        poll,
        media,
        contentType,
      }

      // Failures are left to the form to show: it keeps the text it was given
      return statusPosterService.editStatus(params)
    },
  },
}

export default EditStatusForm
