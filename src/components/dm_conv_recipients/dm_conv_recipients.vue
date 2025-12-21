<template>
  <div class="panel-default panel dm-conv-recipients-edit">
    <div
      ref="header"
      class="panel-heading"
    >
      <div class="title">
        {{ $t('dm_conv.recipients_edit_title', {conversation_name: conversationTitle}) }}
      </div>
      <button
        class="btn button-default"
        @click="$router.back"
      >
        {{ $t('nav.back') }}
      </button>
    </div>
    <h4>
      {{ $t('dm_conv.recipients_edit_current_title') }}
    </h4>
    <div class="member-list current-recipients">
      <div
        v-for="user in recipients"
        :key="user.id"
        class="member"
      >
        <BasicUserCard
          :user="user"
          class="selected"
          @click.capture.prevent="toggleUser(user)"
        />
      </div>
    </div>
    <h4>
      {{ $t('dm_conv.recipients_edit_add_new_title') }}
    </h4>
    <ListUserSearch @results="onResults" />

    <div class="member-list">
      <div
        v-for="user in suggestions"
        :key="user.id"
        class="member"
      >
        <BasicUserCard
          :user="user"
          :class="isRecipient(user) ? 'selected' : ''"
          @click.capture.prevent="toggleUser(user)"
        />
      </div>
    </div>
    <button
      class="btn button-default"
      @click="updateRecipients"
    >
      {{ $t('dm_conv.recipients_save') }}
    </button>
  </div>
</template>

<script src="./dm_conv_recipients.js"></script>

<style lang="scss">
@import '../../_variables.scss';

.dm-conv-recipients-edit {

  .member-list {
    padding-bottom: 0.7rem;
  }

  .current-recipients {
    margin-bottom: 1.5em;
  }

  .basic-user-card:hover,
  .basic-user-card.selected {
    cursor: pointer;
    background-color: var(--selectedPost, $fallback--lightBg);
  }

}
</style>
