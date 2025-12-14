<template>
  <div class="dm-conv-card">
    <router-link
      :to="{ name: 'dm_conversation', params: {id: conversation.id }}"
    >
      <div class="heading">
        <div class="title-bar">
          <div class="title-bar-left">
            <div class="unread"
              v-if="conversation.unread"
            >
              <span
                class="badge badge-notification"
                role="figure"
                :title="$t('dm_conv.unread_msg')"
                :alt="$t('dm_conv.unread_msg')"
              >
                !
              </span>
              <button
                class="button-unstyled"
                :title="$t('dm_conv.mark_single_read_tooltip')"
                @click.stop.prevent="markRead()"
              >
                <FAIcon
                  icon="check"
                  class="fa-scale-110 fa-old-padding dm-conv-mark-read"
                />
              </button>
              &nbsp;
            </div>
            <h4>{{ $t('dm_conv.default_name', {id: this.conversation.id}) }}</h4>
          </div>
          <div class="title-bar-right">
            <button
              class="button-unstyled button-delete"
              :title="$t('dm_conv.delete_tooltip')"
              @click.stop.prevent="deleteConversation()"
            >
              <FAIcon
                icon="trash-alt"
                class="fa-scale-110 fa-old-padding dm-conv-delete"
              />
            </button>
          </div>
        </div>
      </div>
      <div class="members">
        <UserAvatar
          v-for="user in membersTruncated.users"
          :user="user"
          :compact="true"
        />
        <div v-if="membersTruncated.truncated" class="ellipsis">
          ...
        </div>
      </div>
    </router-link>
    <div class="last-message">
      <div class="last-message-title">
        {{ $t('dm_conv.last_message_title') }}:
      </div>
      <Status
        :statusoid="conversation.last_status"
        :compact="true"
        :is-preview="true"
      />
    </div>
    <teleport to="#modal">
      <confirm-modal
        v-if="showingDeleteConfirmDialogue"
        :title="$t('dm_conv.delete_confirm_title')"
        :confirm-text="$t('dm_conv.delete_confirm_accept_button')"
        :cancel-text="$t('dm_conv.delete_confirm_cancel_button')"
        @accepted="doDeleteConversation"
        @cancelled="hideDeleteConfirmModal"
      >
        {{ $t('dm_conv.delete_confirm', { identifier: this.conversation.id }) }}
      </confirm-modal>
    </teleport>
  </div>
</template>

<script src="./dm_conv_card.js"></script>

<style lang="scss">
@import '../../_variables.scss';

.dm-conv-card {
  .heading, .title-bar, .title-bar-left, .members {
    display: flex;
    flex-wrap: nowrap;
    overflow-x: hidden;
  }

  .title-bar {
    width: 100%;
    justify-content: space-between;
  }

  .members {
    padding: 6px 0;
  }

  .last-message-title {
    font-style: italic;
    color: var(--faint);
  }
}
</style>
