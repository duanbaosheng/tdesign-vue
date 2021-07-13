import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import isFunction from 'lodash/isFunction';
import isEqual from 'lodash/isEqual';

import mixins from '../utils/mixins';
import getLocalRecevierMixins from '../locale/local-receiver';
import { TimePickerInstance, TimeInputEvent, InputTime, TimeInputType, TimePickerPanelInstance } from './type';
import { PopupVisibleChangeContext } from '../../types/popup/TdPopupProps';
import { prefix } from '../config';
import CLASSNAMES from '../utils/classnames';
import PickerPanel from './panel';
import TInput from '../input';
import TIconTime from '../icon/time';
import TPopup from '../popup';
import InputItems from './input-items';
import props from '../../types/time-range-picker/props';

import { EPickerCols, TIME_PICKER_EMPTY, EMPTY_VALUE, componentName, amFormat, pmFormat, AM } from './constant';

const name = `${prefix}-time-picker`;

dayjs.extend(customParseFormat);

export default mixins(getLocalRecevierMixins<TimePickerInstance>('timePicker')).extend({
  name: `${prefix}-time-range-picker`,

  components: {
    PickerPanel,
    TIconTime,
    InputItems,
    TPopup,
    TInput,
  },

  props: { ...props },

  data() {
    // 初始化数据
    return {
      els: [],
      focus: false,
      isShowPanel: false,
      // 时间对象
      time: TIME_PICKER_EMPTY as Array<dayjs.Dayjs>,
      // 初始值转input展示对象
      inputTime: TIME_PICKER_EMPTY as Array<InputTime>,
    };
  },

  computed: {
    // 传递给选择面板的时间值
    panelValue(): Array<dayjs.Dayjs> {
      const time = this.time || TIME_PICKER_EMPTY;
      return time.map((val: dayjs.Dayjs) => (val ? dayjs(val) : dayjs()));
    },
    textClassName(): string {
      const isDefault = (this.inputTime as any).some((item: InputTime) => !!item.hour && !!item.minute && !!item.second);
      return isDefault ? '' : `${name}__group-text`;
    },
  },

  watch: {
    value: {
      handler(val, oldVal) {
        if (JSON.stringify(val) === JSON.stringify(oldVal)) return;
        const values = Array.isArray(this.value) ? this.value : [];
        const { format } = this;
        function getVal(value: string | undefined) {
          return value ? dayjs(value, format) : undefined;
        }
        const dayjsList = [getVal(values[0]), getVal(values[1])];
        this.time = dayjsList;
        this.updateInputTime();
      },
      immediate: true,
    },
  },
  methods: {
    // 输入变化
    inputChange(data: TimeInputEvent) {
      const { type, value, index } = data;
      let newTime = this.time[index];
      if (value === EMPTY_VALUE) {
        // 特殊标识，需要清空input
        this.inputTime[index][type] = undefined;
        // 需要重置该类型时间
        newTime[type](0);
        return;
      }
      if (!newTime) {
        // 默认值不存在
        newTime = dayjs();
        newTime.hour(0);
        newTime.minute(0);
        newTime.second(0);
      }
      // @ts-ignore 设置时间 这里暂时只能ignore掉 没有merdiem的类型
      newTime = newTime.set(type, value);
      // 生成变动
      this.time[index] = dayjs(newTime);
      // 转化展示数据
      this.updateInputTime();
      const panelRef = this.$refs.panel as TimePickerPanelInstance;
      panelRef.panelColUpate();
    },
    // 输入失焦，赋值默认
    inputBlurDefault(type: TimeInputType, index: number) {
      this.inputTime[index][type] = '00';
    },
    // 面板展示隐藏
    panelVisibleChange(val: boolean, context?: PopupVisibleChangeContext) {
      if (context) {
        const isClickDoc = context.trigger === 'document';
        this.isShowPanel = !isClickDoc;
        this.$emit(isClickDoc ? 'close' : 'open');
      } else {
        this.isShowPanel = val;
        this.$emit(val ? 'open' : 'close');
      }
    },
    // 切换上下午
    toggleInputMeridiem(index: number) {
      const curTime = this.time[index];
      const current = curTime.format('a');
      const currentHour = curTime.hour() + (current === AM ? 12 : -12);
      // 时间变动
      this.inputChange({ type: 'hour', value: currentHour, index });
    },
    // 选中时间发生变动
    pickTime(col: EPickerCols, change: string | number, index: number, value: Record<string, any>) {
      const { time, format } = this;
      const panelRef = this.$refs.panel as TimePickerPanelInstance;
      let shouldUpdatePanel = false;
      let setTime = time[index];
      if (EPickerCols.hour === col) {
        setTime = value.set(col, value.hour() >= 12 && (amFormat.test(format) || pmFormat.test(format)) ? Number(change) + 12 : change);
      } else if ([EPickerCols.minute, EPickerCols.second].includes(col)) {
        setTime = value.set(col, change);
      } else {
        // 当前上下午
        let currentHour = value.hour();
        // 上下午
        if (change === this.locale.anteMeridiem) {
          // 上午
          currentHour -= 12;
        } else if (change === this.locale.postMeridiem) {
          // 下午
          currentHour += 12;
        }
        setTime = value.hour(currentHour);
      }
      this.time[index] = setTime;
      // 处理初始化为空的逻辑
      if (index === 0 && !this.time[1]) {
        this.time[1] = setTime;
        shouldUpdatePanel = true;
      } else if (index === 1 && !this.time[0]) {
        this.time[0] = dayjs()
          .hour(0)
          .minute(0)
          .second(0);
        shouldUpdatePanel = true;
      }
      this.updateInputTime();
      shouldUpdatePanel && panelRef.panelColUpate();
    },
    // 确定按钮
    makeSure() {
      this.panelVisibleChange(false);
    },
    // 设置输入框展示
    updateInputTime() {
      const {
        $props: { format },
      } = this;
      const disPlayValues: Array<InputTime> = [];
      (this.time || []).forEach((time: dayjs.Dayjs | undefined) => {
        if (!time) {
          disPlayValues.push({
            hour: undefined,
            minute: undefined,
            second: undefined,
            meridiem: AM,
          });
        } else {
          let hour: number | string = time.hour();
          let minute: number | string = time.minute();
          let second: number | string = time.second();
          // 判断12小时制上下午显示问题
          if (/[h]{1}/.test(format)) {
            hour %= 12;
          }
          // 判定是否补齐小于10
          if (/[h|H]{2}/.test(format)) {
            hour = hour < 10 ? `0${hour}` : hour;
          }
          if (/[m|M]{2}/.test(format)) {
            minute = minute < 10 ? `0${minute}` : minute;
          }
          if (/[s|S]{2}/.test(format)) {
            second = second < 10 ? `0${second}` : second;
          }
          disPlayValues.push({
            hour,
            minute,
            second,
            meridiem: time.format('a'),
          });
        }
      });
      this.inputTime = disPlayValues;
      this.triggleUpdateValue();
    },
    // 清除选中
    clear() {
      this.time = TIME_PICKER_EMPTY;
      this.updateInputTime();
    },
    triggleUpdateValue() {
      const values: Array<string> = [];
      this.time.forEach((time) => {
        if (time) {
          values.push(time.format(this.format));
        }
      });
      this.$emit('change', values);
      isFunction(this.onChange) && this.onChange(values);
    },
    renderInput() {
      const classes = [`${name}__group`,
        {
          [`${prefix}-is-focused`]: this.isShowPanel,
        }];
      return (
        <div class={classes} onClick={() => this.isShowPanel = true}>
          <t-input
            disabled={this.disabled}
            size={this.size}
            onClear={this.clear}
            clearable={this.clearable}
            readonly
            value={!isEqual(this.time, TIME_PICKER_EMPTY) ? ' ' : undefined}
          >
            <t-icon-time slot="suffix-icon"></t-icon-time>
          </t-input>
          <input-items
            size={this.size}
            dayjs={this.inputTime}
            disabled={this.disabled}
            format={this.format}
            allowInput={this.allowInput}
            placeholder={this.placeholder}
            isRangePicker
            onToggleMeridiem={(index: number) => this.toggleInputMeridiem(index)}
            onBlurDefault={(type: TimeInputType, index: number) => this.inputBlurDefault(type, index)}
            onChange={(e: TimeInputEvent) => this.inputChange(e)}
          />
        </div>
      );
    },
  },
  render() {
    // 初始化数据
    const {
      $props: { size, className, disabled },
    } = this;
    // 样式类名
    const classes = [name, CLASSNAMES.SIZE[size], className];

    return (
      <t-popup
        ref="popup"
        class={classes}
        placement="bottom-left"
        trigger="click"
        disabled={disabled}
        visible={this.isShowPanel}
        overlayClassName={`${componentName}-panel__container`}
        on={{ 'visible-change': this.panelVisibleChange }}
      >
        {this.renderInput()}
        <template slot="content">
          <picker-panel
            ref="panel"
            format={this.format}
            value={this.panelValue}
            disabled={this.disabled}
            isShowPanel={this.isShowPanel}
            ontime-pick={this.pickTime}
            onsure={this.makeSure}
            steps={this.steps}
            hideDisabledTime={this.hideDisabledTime}
            disableTime={this.disableTime}
            isFocus={this.focus}
          />
        </template>
      </t-popup>
    );
  },
});
