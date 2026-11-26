<template>
  <div
    v-if="visible"
    class="poll-form"
  >
    <div
      v-for="(option, index) in options"
      :key="index"
      class="poll-option"
    >
      <div class="input-container">
        <input
          :id="`poll-${index}`"
          :model-value="options[index]"
          size="1"
          class="input poll-option-input"
          type="text"
          :placeholder="$t('polls.option')"
          :maxlength="maxLength"
          :aria-label="$t('polls.option')"
          @keydown.enter.stop.prevent="nextOption(index)"
          @change="(e) => updateOption(index, e.target.value)"
        >
      </div>
      <button
        type="button"
        v-if="options.length > 2"
        class="delete-option button-unstyled -hover-highlight"
        @click="deleteOption(index)"
      >
        <FAIcon icon="times" />
      </button>
    </div>
    <button
      type="button"
      v-if="options.length < maxOptions"
      class="add-option faint button-unstyled -hover-highlight"
      @click="addOption"
    >
      <FAIcon
        icon="plus"
        size="sm"
      />

      {{ $t("polls.add_option") }}
    </button>
    <div class="poll-type-expiry">
      <div
        class="poll-type"
        :title="$t('polls.type')"
      >
        <Select
          v-model="pollType"
          class="poll-type-select"
          unstyled="true"
        >
          <option value="single">
            {{ $t('polls.single_choice') }}
          </option>
          <option value="multiple">
            {{ $t('polls.multiple_choices') }}
          </option>
        </Select>
      </div>
      <div
        class="poll-expiry"
        :title="$t('polls.expiry')"
      >
        <input
          v-model="expiryAmount"
          type="number"
          class="input expiry-amount hide-number-spinner"
          :min="minExpirationInCurrentUnit"
          :max="maxExpirationInCurrentUnit"
          :aria-label="$t('polls.expiry_amount')"
          @change="expiryAmountChange"
        >
        {{ ' ' }}
        <Select
          v-model="expiryUnit"
          unstyled="true"
          class="expiry-unit"
          :aria-label="$t('polls.expiry_unit')"
          @change="expiryAmountChange"
        >
          <option
            v-for="unit in expiryUnits"
            :key="unit"
            :value="unit"
          >
            {{ $t(`time.unit.${unit}_short`, [''], expiryAmount) }}
          </option>
        </Select>
      </div>
    </div>
  </div>
</template>

<script src="./poll_form.js"></script>

<style lang="scss">
.poll-form {
  display: flex;
  flex-direction: column;
  padding: 0 0.5em 0.5em;

  .add-option {
    align-self: flex-start;
    padding-top: 0.25em;
    padding-left: 0.1em;
  }

  .poll-option {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 0.25em;
  }

  .input-container {
    width: 100%;

    input {
      // Hack: dodge the floating X icon
      padding-right: 2.5em;
      width: 100%;
    }
  }

  .delete-option {
    // Hack: Move the icon over the input box
    width: 1.5em;
    margin-left: -1.5em;
    z-index: 1;
  }

  .poll-type-expiry {
    margin-top: 0.5em;
    display: flex;
    width: 100%;
  }

  .poll-type {
    margin-right: 0.75em;
    flex: 1 1 60%;

    .poll-type-select {
      padding-right: 0.75em;
    }
  }

  .poll-expiry {
    display: flex;

    .expiry-amount {
      width: 3em;
      text-align: right;
    }
  }
}
</style>
