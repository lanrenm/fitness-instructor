import React from 'react';
// style-loader v4 + lazyStyleTag: see AuthPage/index.tsx for rationale.
import _styles from './index.module.css';
const styles = _styles.locals ?? _styles;

const index: React.FC<object> = ({}) => {
  return (
    <div className={styles.brandingSection}>
        <h2>开启您的<br />健身之旅</h2>
        <p>记录训练轨迹，科学管理饮食，让每一次进步都清晰可见</p>
        <div className={styles.featureList}>
          <div className={styles.featureItem}>
            <span className={styles.featureDot} /> 
            <span>个性化训练计划</span>
          </div>
          <div className={styles.featureItem}>
            <span className={styles.featureDot} />
            <span>动作库查询</span>
          </div>
          <div className={styles.featureItem}>
            <span className={styles.featureDot} />
            <span>AI 智能计划调整</span>
          </div>
        </div>
      </div>
  );
};

export default index;