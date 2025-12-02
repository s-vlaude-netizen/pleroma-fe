<template>
  <div class="settings panel panel-default dm-conv-panel">
    <div class="panel-heading">
      <div class="title">
        {{ $t('nav.dm_conv_list') }}
      </div>
    </div>
    <div class="panel-controls">
      <button
        class="btn button-default mark-all-read-button"
        @click="markAllRead()"
      >
        {{ $t('dm_conv.mark_all_read_button') }}
      </button>
    </div>
    <div class="panel-body dm-conv-list">
      <PaginatedDMConvList>
        <template #item="{item}">
          <DMConvCard :conversation="item" />
        </template>
      </PaginatedDMConvList>
    </div>
  </div>
</template>

<script src="./dm_conv_list.js"></script>

<style lang="scss">
.dm-conv-panel {
  .dm-conv-list {
    margin: 0 1em;

    .dm-conv-card {
      margin: 2.5em 0;
    }
  }

  .panel-controls {
    margin-top: 0.5em;
    text-align: center;
  }

  .mark-all-read-button {
    display: inline-block;
  }
}
</style>
