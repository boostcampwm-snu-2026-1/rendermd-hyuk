# Math — all delimiter forms

Inline forms: $\pi \approx 3.14$ and \(\sigma = \sqrt{\frac{1}{N}\sum (x_i - \mu)^2}\).

Block (dollar, multi-line — the form remark-math accepts directly):

$$
E = mc^2
$$

Block (bracket):

\[
\int_0^\infty e^{-x^2}\,dx = \frac{\sqrt{\pi}}{2}
\]

Compact bracket with env (the LLM-paste shape, rescued by both
preprocessors):

\[\begin{aligned}
\text{Subproblem 1: } & \mathcal{F}_{LP} \cap \{ x_j \le \lfloor x_j^* \rfloor \} \\
\text{Subproblem 2: } & \mathcal{F}_{LP} \cap \{ x_j \ge \lceil x_j^* \rceil \}
\end{aligned}\]

Compact dollar with env (rescued by the canonicalizer):

$$\begin{aligned}
a &= b \\
c &= d
\end{aligned}$$
