<template>
  <Modal
    v-if="isVisible"
    class="search-form-modal-view"
    @backdrop-clicked="closeModal"
  >
    <div class="search-form-modal-panel panel">
      <div class="panel-heading">
        {{ $t('nav.search') }}
      </div>
      <SearchForm
        ref="searchForm"
        @searched="closeModal"
        @vue:mounted="focus"
      />
    </div>
  </Modal>
</template>

<script src="./search_form_modal.js"></script>

<style lang="scss">
.modal-view.search-form-modal-view {
  align-items: flex-start;

  .search-form-modal-panel {
    flex-shrink: 0;
    margin-top: 5%;
    margin-bottom: 2em;
    width: 100%;
    max-width: 700px;
  }
}
</style>
