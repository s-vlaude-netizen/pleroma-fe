<template>
  <div
    class="user-card"
    :class="classes"
  >
    <div
      class="background-image"
      :class="{ 'hide-bio': hideBio }"
    >
      <div
        class="image-tint"
      />
      <img
        class="image-banner"
        width="100%"
        :src="user.cover_photo"
      />
    </div>
    <div class="panel-heading -flexible-height">
      <div
        class="user-info"
        :class="{ '-compact': compactUserInfo }"
      >
        <div class="container">
          <a
            v-if="allowZoomingAvatar"
            class="user-info-avatar-link"
            @click="zoomAvatar"
          >
            <UserAvatar
              :better-shadow="betterShadow"
              :user="user"
            />
            <div class="user-info-avatar-link-overlay">
              <FAIcon
                class="fa-scale-110 fa-old-padding"
                icon="search-plus"
              />
            </div>
          </a>
          <router-link
            v-else
            class="user-info-avatar-link"
            :to="userProfileLink(user)"
          >
            <UserAvatar
              :better-shadow="betterShadow"
              :user="user"
            />
          </router-link>
          <RichContent
            :title="user.name"
            class="user-name"
            :html="user.name"
            :emoji="user.emoji"
          />
          <div class="user-summary">
            <router-link
              class="user-screen-name"
              :title="user.screen_name_ui"
              :to="userProfileLink(user)"
            >
              @{{ user.screen_name_ui }}
            </router-link>
            <span
              v-if="!hideBio && (user.deactivated || !!visibleRole || user.bot)"
              class="user-roles"
            >
              <span
                v-if="user.deactivated"
                class="alert user-role"
              >
                {{ $t('user_card.deactivated') }}
              </span>
              <span
                v-if="!!visibleRole"
                class="alert user-role"
              >
                {{ $t(`general.role.${visibleRole}`) }}
              </span>
              <span
                v-if="user.bot"
                class="alert user-role"
              >
                {{ $t('user_card.bot') }}
              </span>
            </span>
            <span
              v-if="user.locked"
              class="user-locked"
            >
              <FAIcon
                class="lock-icon"
                icon="lock"
                size="sm"
              />
            </span>
            <span
              v-if="!mergedConfig.hideUserStats && !hideBio"
              class="dailyAvg"
            >{{ dailyAvg }} {{ $t('user_card.per_day') }}</span>
          </div>
          <div
            v-if="!mergedConfig.hideUserStats && switcher"
            class="user-counts"
          >
            <div
              class="user-count"
              @click.prevent="setProfileView('statuses')"
            >
              <h5>{{ $t('user_card.statuses') }}</h5>
              <span>{{ user.statuses_count }} <br></span>
            </div>
            <div
              class="user-count"
              @click.prevent="setProfileView('friends')"
            >
              <h5>{{ $t('user_card.followees') }}</h5>
              <span>{{ hideFollowsCount ? $t('user_card.hidden') : user.friends_count }}</span>
            </div>
            <div
              class="user-count"
              @click.prevent="setProfileView('followers')"
            >
              <h5>{{ $t('user_card.followers') }}</h5>
              <span>{{ hideFollowersCount ? $t('user_card.hidden') : user.followers_count }}</span>
            </div>
          </div>
          <div class="user-buttons">
            <button
              v-if="!isOtherUser && user.is_local"
              class="button-unstyled edit-profile-button"
              @click.stop="openProfileTab"
            >
              <FAIcon
                fixed-width
                class="icon"
                icon="edit"
                :title="$t('user_card.edit_profile')"
              />
            </button>
            <a
              v-if="isOtherUser && !user.is_local"
              :href="user.statusnet_profile_url"
              target="_blank"
              class="button-unstyled external-link-button"
            >
              <FAIcon
                class="icon"
                icon="external-link-alt"
              />
            </a>
            <a
              v-if="isOtherUser"
              :href="user.statusnet_profile_url + '.rss'"
              target="_blank"
              class="button-unstyled external-link-button"
            >
              <FAIcon
                class="icon"
                icon="rss"
              />
            </a>
            <AccountActions
              v-if="isOtherUser && loggedIn"
              :user="user"
              :relationship="relationship"
            />
          </div>
        </div>
        <div class="user-meta">
          <div
            v-if="relationship.blocked_by && loggedIn && isOtherUser"
            class="blocking"
          >
            {{ $t('user_card.blocks_you') }}
          </div>
          <div
            v-if="relationship.followed_by && loggedIn && isOtherUser"
            class="following"
          >
            {{ $t('user_card.follows_you') }}
          </div>
          <div
            v-if="relationship.requested_by && loggedIn && isOtherUser"
            class="requested_by"
          >
            {{ $t('user_card.requested_by') }}
          </div>
          <div
            v-if="isOtherUser && (loggedIn || !switcher)"
            class="highlighter"
          >
            <!-- id's need to be unique, otherwise vue confuses which user-card checkbox belongs to -->
            <input
              v-if="userHighlightType !== 'disabled'"
              :id="'userHighlightColorTx'+user.id"
              v-model="userHighlightColor"
              class="userHighlightText"
              type="text"
            >
            <input
              v-if="userHighlightType !== 'disabled'"
              :id="'userHighlightColor'+user.id"
              v-model="userHighlightColor"
              class="userHighlightCl"
              type="color"
            >
            {{ ' ' }}
            <Select
              :id="'userHighlightSel'+user.id"
              v-model="userHighlightType"
              class="userHighlightSel"
            >
              <option value="disabled">
                {{ $t('user_card.highlight.disabled') }}
              </option>
              <option value="solid">
                {{ $t('user_card.highlight.solid') }}
              </option>
              <option value="striped">
                {{ $t('user_card.highlight.striped') }}
              </option>
              <option value="side">
                {{ $t('user_card.highlight.side') }}
              </option>
            </Select>
          </div>
          <div
            v-if="showMediaButton"
            class="user-profile-media-button"
          >
            <button
              class="btn button-default"
              :title="$i18n.t('user_card.show_profile_media')"
              :aria-label="$i18n.t('user_card.show_profile_media')"
              :disabled="!hasProfileMedia"
              @click="showProfileMedia"
            >
              <FAIcon
                icon="images"
                class="fa-scale-110 fa-old-padding"
              />
            </button>
          </div>
        </div>
        <div
          v-if="loggedIn && isOtherUser"
          class="user-interactions"
        >
          <div class="btn-group">
            <FollowButton
              :relationship="relationship"
              :user="user"
              :disabled="relationship.blocked_by"
            />
            <template v-if="relationship.following">
              <ProgressButton
                v-if="!relationship.subscribing"
                class="btn button-default"
                :click="subscribeUser"
                :title="$t('user_card.subscribe')"
              >
                <FAIcon icon="bell" />
              </ProgressButton>
              <ProgressButton
                v-else
                class="btn button-default toggled"
                :click="unsubscribeUser"
                :title="$t('user_card.unsubscribe')"
              >
                <FALayers>
                  <FAIcon
                    icon="rss"
                    transform="left-5 shrink-6 up-3 rotate-20"
                    flip="horizontal"
                  />
                  <FAIcon
                    icon="rss"
                    transform="right-5 shrink-6 up-3 rotate-20"
                  />
                  <FAIcon icon="bell" />
                </FALayers>
              </ProgressButton>
            </template>
          </div>
          <div>
            <button
              v-if="relationship.muting"
              class="btn button-default btn-block toggled"
              :disabled="user.deactivated"
              @click="unmuteUser"
            >
              {{ $t('user_card.muted') }}
            </button>
            <button
              v-else
              class="btn button-default btn-block"
              :disabled="user.deactivated"
              @click="muteUser"
            >
              {{ $t('user_card.mute') }}
            </button>
          </div>
          <div>
            <button
              class="btn button-default btn-block"
              :disabled="user.deactivated"
              @click="mentionUser"
            >
              {{ $t('user_card.mention') }}
            </button>
          </div>
          <ModerationTools
            v-if="loggedIn.role === 'admin'"
            :user="user"
          />
        </div>
        <div
          v-if="!loggedIn && user.is_local"
          class="user-interactions"
        >
          <RemoteFollow :user="user" />
        </div>
      </div>
    </div>
    <div
      v-if="!hideBio"
      class="panel-body"
    >
      <RichContent
        v-if="!hideBio"
        class="user-card-bio"
        :html="user.description_html"
        :emoji="user.emoji"
        :handle-links="true"
        :style='{"text-align": $store.getters.mergedConfig.centerAlignBio ? "center" : "start"}'
      />
    </div>
    <teleport to="#modal">
      <confirm-modal
        v-if="showingConfirmMute"
        :title="$t('user_card.mute_confirm_title')"
        :confirm-text="$t('user_card.mute_confirm_accept_button')"
        :cancel-text="$t('user_card.mute_confirm_cancel_button')"
        @accepted="doMuteUser"
        @cancelled="hideConfirmMute"
      >
        <i18n-t
          keypath="user_card.mute_confirm"
          tag="span"
        >
          <template #user>
            <span
              v-text="user.screen_name_ui"
            />
          </template>
        </i18n-t>
      </confirm-modal>
    </teleport>
  </div>
</template>

<script src="./user_card.js"></script>

<style lang="scss" src="./user_card.scss" />
