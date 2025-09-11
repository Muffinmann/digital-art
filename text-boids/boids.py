import numpy as np
from gensim.models import KeyedVectors

class TextualBoidsSimulator:
    def __init__(self, model_path):
        # 加载预训练的词向量模型
        print("正在加载词向量模型...")
        self.model = KeyedVectors.load_word2vec_format(model_path, binary=True)
        print("模型加载完成。")
        
        # 预设规则权重
        self.separation_weight = 1.5
        self.alignment_weight = 1.0
        self.cohesion_weight = 1.2
        
    def get_word_vector(self, word):
        """获取词汇的向量，如果词不在词表中，返回一个零向量。"""
        try:
            return self.model[word]
        except KeyError:
            return np.zeros(self.model.vector_size)

    def calculate_separation_vector(self, word_vec, neighbor_vecs):
            """
            分离规则：避免语义/语法冲突。
            通过计算与邻居的向量距离来判断排斥力。
            """
            separation_vec = np.zeros(self.model.vector_size)
            for neighbor_vec in neighbor_vecs:
                distance = np.linalg.norm(word_vec - neighbor_vec)
                
                # 如果距离太近，产生一个排斥力
                if distance < 0.5:  # 距离阈值，可调
                    direction = (word_vec - neighbor_vec)
                    separation_vec += direction / (distance + 1e-6) # 距离越近，力越大
            return separation_vec

    def calculate_alignment_vector(self, word_vec, neighbor_vecs):
        """
        对齐规则：模仿邻居的风格和方向。
        通过计算邻居向量的平均方向。
        """
        if not neighbor_vecs:
            return np.zeros(self.model.vector_size)
        
        # 计算所有邻居向量的平均值，作为对齐方向
        avg_direction = np.mean(neighbor_vecs, axis=0)
        return avg_direction

    def calculate_cohesion_vector(self, word_vec, neighbor_vecs):
        """
        聚合规则：靠近语义相似的词汇。
        计算邻居向量的平均位置，作为聚合中心。
        """
        if not neighbor_vecs:
            return np.zeros(self.model.vector_size)
        
        # 计算邻居向量的平均位置，并指向该位置
        avg_position = np.mean(neighbor_vecs, axis=0)
        cohesion_vec = avg_position - word_vec
        return cohesion_vec
    def run_simulation(self, initial_words, iterations):
        """
        运行模拟，生成文本。
        """
        text = initial_words
        
        for i in range(iterations):
            print(f"--- 迭代 {i+1} ---")
            
            # 简化版：我们只考虑最后一个词作为“当前Boid”，它将根据前面的邻居来决定下一个词。
            current_word = text[-1]
            current_vec = self.get_word_vector(current_word)
            
            # 邻居：假设是前面N个词
            neighbors = text[-min(len(text), 5):-1]  # 取最近的5个邻居
            neighbor_vecs = [self.get_word_vector(w) for w in neighbors]
            
            # 1. 计算三个力向量
            separation_vec = self.calculate_separation_vector(current_vec, neighbor_vecs)
            alignment_vec = self.calculate_alignment_vector(current_vec, neighbor_vecs)
            cohesion_vec = self.calculate_cohesion_vector(current_vec, neighbor_vecs)
            
            # 2. 合并三个力向量，得到最终的“运动”向量
            total_force_vec = (
                self.separation_weight * separation_vec +
                self.alignment_weight * alignment_vec +
                self.cohesion_weight * cohesion_vec
            )
            
            # 3. 寻找最接近“运动”向量的词
            # 这个是关键步骤，我们将最终的向量作为搜索目标，在整个词汇表中寻找最相似的词。
            try:
                # 排除已有的词，避免重复
                excluded_words = set(text)
                
                # 寻找最相似的词
                most_similar_words = self.model.most_similar(positive=[total_force_vec], topn=10)
                
                # 找到一个不在当前文本中的词作为下一个词
                next_word = ""
                for word, _ in most_similar_words:
                    if word not in excluded_words:
                        next_word = word
                        break
                
                if next_word:
                    text.append(next_word)
                else:
                    # 如果找不到合适的词，随机选择一个
                    text.append(np.random.choice(self.model.index_to_key))

            except Exception as e:
                print(f"寻找下一个词时出错：{e}")
                break
            
            print(" ".join(text))
        
        return " ".join(text)


if __name__ == "__main__":
    # 替换成你下载的词向量模型路径
    model_path = "light_Tencent_AILab_ChineseEmbedding.bin"
    
    # 初始化模拟器
    simulator = TextualBoidsSimulator(model_path)
    
    # 初始文本，作为Boids的起点
    initial_text = ["鸟", "湖泊", "星星"]
    
    # 运行模拟，生成20个词
    final_text = simulator.run_simulation(initial_text, iterations=20)
    
    print("\n--- 最终生成的文本 ---")
    print(final_text)