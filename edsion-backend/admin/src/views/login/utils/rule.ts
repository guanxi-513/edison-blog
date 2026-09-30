import { reactive } from "vue";
import { isPhone } from "@pureadmin/utils";
import type { FormRules } from "element-plus";
import { $t, transformI18n } from "@/plugins/i18n";
import { useUserStoreHook } from "@/store/modules/user";

/** 6位数字验证码正则 */
export const REGEXP_SIX = /^\d{6}$/;

/**
 * 密码正则（3-18 位，允许纯符号；仅禁止中文）
 *
 * 已按本站需要放宽：原规则要求「8 位起 + 数字/字母/符号任意两种组合」，
 * 而 `=`、`+` 等符号在正则字符类中同属一类，导致 `===+++===` 这类纯符号
 * 密码被前端拦下、无法登录后台。此处改为只要不含中文即可通过，
 * 真正的强度要求交由后端与运维层面控制。
 */
export const REGEXP_PWD = /^[^\u4E00-\u9FA5]{3,18}$/;

/** 登录校验 */
const loginRules = reactive<FormRules>({
  password: [
    {
      validator: (rule, value, callback) => {
        if (value === "") {
          callback(new Error(transformI18n($t("login.purePassWordReg"))));
        } else if (!REGEXP_PWD.test(value)) {
          callback(new Error(transformI18n($t("login.purePassWordRuleReg"))));
        } else {
          callback();
        }
      },
      trigger: "blur"
    }
  ],
  verifyCode: [
    {
      validator: (rule, value, callback) => {
        if (value === "") {
          callback(new Error(transformI18n($t("login.pureVerifyCodeReg"))));
        } else if (useUserStoreHook().verifyCode !== value) {
          callback(
            new Error(transformI18n($t("login.pureVerifyCodeCorrectReg")))
          );
        } else {
          callback();
        }
      },
      trigger: "blur"
    }
  ]
});

/** 手机登录校验 */
const phoneRules = reactive<FormRules>({
  phone: [
    {
      validator: (rule, value, callback) => {
        if (value === "") {
          callback(new Error(transformI18n($t("login.purePhoneReg"))));
        } else if (!isPhone(value)) {
          callback(new Error(transformI18n($t("login.purePhoneCorrectReg"))));
        } else {
          callback();
        }
      },
      trigger: "blur"
    }
  ],
  verifyCode: [
    {
      validator: (rule, value, callback) => {
        if (value === "") {
          callback(new Error(transformI18n($t("login.pureVerifyCodeReg"))));
        } else if (!REGEXP_SIX.test(value)) {
          callback(new Error(transformI18n($t("login.pureVerifyCodeSixReg"))));
        } else {
          callback();
        }
      },
      trigger: "blur"
    }
  ]
});

/** 忘记密码校验 */
const updateRules = reactive<FormRules>({
  phone: [
    {
      validator: (rule, value, callback) => {
        if (value === "") {
          callback(new Error(transformI18n($t("login.purePhoneReg"))));
        } else if (!isPhone(value)) {
          callback(new Error(transformI18n($t("login.purePhoneCorrectReg"))));
        } else {
          callback();
        }
      },
      trigger: "blur"
    }
  ],
  verifyCode: [
    {
      validator: (rule, value, callback) => {
        if (value === "") {
          callback(new Error(transformI18n($t("login.pureVerifyCodeReg"))));
        } else if (!REGEXP_SIX.test(value)) {
          callback(new Error(transformI18n($t("login.pureVerifyCodeSixReg"))));
        } else {
          callback();
        }
      },
      trigger: "blur"
    }
  ],
  password: [
    {
      validator: (rule, value, callback) => {
        if (value === "") {
          callback(new Error(transformI18n($t("login.purePassWordReg"))));
        } else if (!REGEXP_PWD.test(value)) {
          callback(new Error(transformI18n($t("login.purePassWordRuleReg"))));
        } else {
          callback();
        }
      },
      trigger: "blur"
    }
  ]
});

export { loginRules, phoneRules, updateRules };
