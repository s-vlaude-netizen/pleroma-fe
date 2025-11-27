<template>
  <div class="settings panel panel-default">
    <div class="panel-heading">
      <div class="title">
        {{ $t('nav.dm_conv_list') }}
      </div>
    </div>
    <!--
      TODO: add button to mark all as read
    -->
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
  .dm-conv-list {
    margin: 0 1em;

    .dm-conv-card {
      margin: 2.5em 0;
    }
  }
</style>
