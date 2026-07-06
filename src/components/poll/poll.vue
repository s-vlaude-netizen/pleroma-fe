<template>
  <div
    ref="pollContainer"
    class="poll"
    :class="containerClasses"
  >
    <button
      v-show="collapsable && !collapsed"
      class="show-less-button button-unstyled -link"
      @click.stop.prevent="collapse(true)"
    >
      {{ $t('polls.show_less') }}
    </button>
    <button
      v-show="collapsed"
      class="show-more-button button-unstyled -link"
      @click.stop.prevent="collapse(false)"
    >
      {{ $t('polls.show_full') }}
    </button>
    <div class="poll-content">
      <div
        v-for="(option, index) in options"
        :key="index"
        class="poll-option"
      >
        <div
          v-if="showResults"
          :title="resultTitle(option)"
          class="option-result"
        >
          <div class="option-result-label">
            <span
              v-if="ownVotes.length > 0"
              class="result-vote-indicator"
            >
              {{ ownVotes.includes(index) ? '\u2714' : '' }}
            </span>
            <span class="result-percentage">
              {{ percentageForOption(option.votes_count) }}%
            </span>
            <RichContent
              :html="option.title_html"
              :handle-links="false"
              :emoji="emoji"
            />
          </div>
          <div
            class="result-fill"
            :style="{ 'width': `${percentageForOption(option.votes_count)}%` }"
          />
        </div>
        <div
          v-else
          @click="activateOption(index)"
        >
          <input
            v-if="poll.multiple"
            type="checkbox"
            :disabled="loading"
            :value="index"
          >
          <input
            v-else
            type="radio"
            :disabled="loading"
            :value="index"
          >
          <label class="option-vote">
            <RichContent
              :html="option.title_html"
              :handle-links="false"
              :emoji="emoji"
            />
          </label>
        </div>
      </div>
      <div class="poll-hint">
        <div
          v-if="poll.akkoma?.anonymous === true"
          class="alert success"
        >
          <FAIcon icon="check-circle" />
          &nbsp;
          {{ $t('polls.indicate_anonymous') }}
        </div>
        <div
          v-else-if="poll.akkoma?.anonymous === false"
          class="alert warning"
        >
          <FAIcon icon="triangle-exclamation" />
          &nbsp;
          {{ $t('polls.indicate_disclosure') }}
        </div>
      </div>
      <div class="footer faint">
        <button
          v-if="!showResults"
          class="btn button-default poll-vote-button"
          type="button"
          :disabled="isDisabled"
          @click="vote"
        >
          {{ $t('polls.vote') }}
        </button>
        <button
          v-if="!showResults"
          class="btn button-default poll-results-toggle-button"
          type="button"
          :disabled="!isDisabled"
          @click="peekResults(true)"
        >
          {{ $t('polls.show_results') }}
        </button>
        <button
          v-else-if="canVote"
          class="btn button-default poll-results-toggle-button"
          type="button"
          @click="peekResults(false)"
        >
          {{ $t('polls.hide_results') }}
        </button>
        <div class="total">
          <template v-if="typeof poll.voters_count === 'number'">
            {{ $tc("polls.people_voted_count", poll.voters_count, { count: poll.voters_count }) }}&nbsp;·&nbsp;
          </template>
          <template v-else>
            {{ $tc("polls.votes_count", poll.votes_count, { count: poll.votes_count }) }}&nbsp;·&nbsp;
          </template>
        </div>
        <span>
          <i18n-t
            scope="global"
            :keypath="expired ? 'polls.expired' : 'polls.expires_in'"
          >
            <Timeago
              :time="expiresAt"
              :auto-update="60"
              :now-threshold="0"
            />
          </i18n-t>
        </span>
      </div>
    </div>
  </div>
</template>

<script src="./poll.js"></script>

<style lang="scss">
@import '../../_variables.scss';

.poll {
  // keep in sync with js!
  max-height: 330px;
  overflow-y: hide;

  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 1;

  &.collapsable:not(.collapsed) {
    max-height: unset;
  }

  &.collapsed {
    .poll-content {
      mask: linear-gradient(
        to bottom,
        white 260px,
        transparent 330px
      );
    }
  }

  .poll-content {
    padding-top: 0.375em;
  }

  .show-less-button, .show-more-button {
    z-index: 2;
    display: inline-block;
    width: 100%;
    text-align: center;
  }

  .show-less-button {
    position: relative;
  }

  .show-more-button {
    position: absolute;
    margin-top: 260px;
    height: 70px;
    line-height: 110px;
  }

  .votes {
    display: flex;
    flex-direction: column;
    margin: 0 0 0.5em;
  }
  .poll-option {
    margin: 0.375em 0.5em;
  }
  .option-result {
    height: 100%;
    display: flex;
    flex-direction: row;
    position: relative;
    color: $fallback--lightText;
    color: var(--lightText, $fallback--lightText);
  }
  .option-result-label {
    display: flex;
    align-items: center;
    padding: 0.1em 0.25em;
    z-index: 1;
    word-break: break-word;
  }
  .result-vote-indicator {
    width: 1em;
    margin-right: 0.5em;
    text-align: center;
  }
  .result-percentage {
    width: 3.5em;
    flex-shrink: 0;
  }
  .result-fill {
    height: 100%;
    position: absolute;
    color: $fallback--text;
    color: var(--pollText, $fallback--text);
    background-color: $fallback--lightBg;
    background-color: var(--poll, $fallback--lightBg);
    border-radius: $fallback--panelRadius;
    border-radius: var(--panelRadius, $fallback--panelRadius);
    top: 0;
    left: 0;
    transition: width 0.5s;
  }
  .option-vote {
    display: flex;
    align-items: center;
  }
  input {
    width: 3.5em;
  }
  .footer {
    display: flex;
    align-items: center;
  }
  .poll-hint {
    margin: 0.25em 0;
  }
  &.loading * {
    cursor: progress;
  }
  .poll-vote-button, .poll-results-toggle-button {
    padding: 0 0.5em;
    margin-right: 0.5em;
  }
}
</style>
